package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type BackupPayload struct {
	Version      string               `json:"version"`
	ExportedAt   time.Time            `json:"exported_at"`
	UserEmail    string               `json:"user_email"`
	Currency     string               `json:"currency"`
	Categories   []models.Category    `json:"categories"`
	Transactions []models.Transaction `json:"transactions"`
}

type RecordBackupRequest struct {
	FileID     string `json:"file_id" binding:"required"`
	FileName   string `json:"file_name" binding:"required"`
	RecordSize int    `json:"record_size"`
}

func ExportBackup(c *gin.Context) {
	userID := c.GetString("userID")
	userEmail := c.GetString("userEmail")

	var user models.User
	database.DB.First(&user, "id = ?", userID)

	var categories []models.Category
	database.DB.Where("user_id = ?", userID).Find(&categories)

	var transactions []models.Transaction
	database.DB.Where("user_id = ?", userID).Find(&transactions)

	payload := BackupPayload{
		Version:      "1.0.0",
		ExportedAt:   time.Now(),
		UserEmail:    userEmail,
		Currency:     user.Currency,
		Categories:   categories,
		Transactions: transactions,
	}

	c.JSON(http.StatusOK, payload)
}

func ImportBackup(c *gin.Context) {
	userID := c.GetString("userID")

	var payload BackupPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup payload format: " + err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Map old category IDs to existing/new category IDs
	categoryIDMap := make(map[string]string)

	for _, cat := range payload.Categories {
		var existing models.Category
		if err := tx.Where("user_id = ? AND name = ? AND type = ?", userID, cat.Name, cat.Type).First(&existing).Error; err == nil {
			categoryIDMap[cat.ID] = existing.ID
		} else {
			newCat := models.Category{
				UserID:    userID,
				Name:      cat.Name,
				Type:      cat.Type,
				Icon:      cat.Icon,
				Color:     cat.Color,
				IsDefault: cat.IsDefault,
			}
			if err := tx.Create(&newCat).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore category: " + err.Error()})
				return
			}
			categoryIDMap[cat.ID] = newCat.ID
		}
	}

	// Restore transactions
	restoredCount := 0
	for _, t := range payload.Transactions {
		targetCatID, ok := categoryIDMap[t.CategoryID]
		if !ok {
			// Find fallback category of same type
			var fallback models.Category
			if err := tx.Where("user_id = ? AND type = ?", userID, t.Type).First(&fallback).Error; err == nil {
				targetCatID = fallback.ID
			} else {
				continue
			}
		}

		newTx := models.Transaction{
			UserID:        userID,
			Amount:        t.Amount,
			Type:          t.Type,
			CategoryID:    targetCatID,
			PaymentMethod: t.PaymentMethod,
			Note:          t.Note,
			Date:          t.Date,
		}

		if err := tx.Create(&newTx).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore transaction: " + err.Error()})
			return
		}
		restoredCount++
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message":               "Backup restored successfully",
		"restored_transactions": restoredCount,
		"restored_categories":   len(categoryIDMap),
	})
}

func RecordBackupLog(c *gin.Context) {
	userID := c.GetString("userID")

	var req RecordBackupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	logEntry := models.BackupLog{
		UserID:     userID,
		Provider:   "google_drive",
		FileID:     req.FileID,
		FileName:   req.FileName,
		RecordSize: req.RecordSize,
		Status:     "completed",
	}

	if err := database.DB.Create(&logEntry).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record backup log"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"backup_log": logEntry})
}

func GetBackupHistory(c *gin.Context) {
	userID := c.GetString("userID")

	var logs []models.BackupLog
	if err := database.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(10).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch backup logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"backups": logs})
}
