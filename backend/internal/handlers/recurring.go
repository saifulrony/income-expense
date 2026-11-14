package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type CreateRecurringRequest struct {
	Amount        float64                `json:"amount" binding:"required,gt=0"`
	Type          models.TransactionType `json:"type" binding:"required,oneof=income expense"`
	CategoryID    string                 `json:"category_id" binding:"required"`
	PaymentMethod string                 `json:"payment_method"`
	Note          string                 `json:"note"`
	Frequency     string                 `json:"frequency" binding:"required,oneof=daily weekly monthly"`
	StartDate     *time.Time             `json:"start_date"`
}

func ListRecurring(c *gin.Context) {
	userID := c.GetString("userID")

	var items []models.RecurringTransaction
	if err := database.DB.Preload("Category").Where("user_id = ?", userID).Order("created_at DESC").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recurring rules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"recurring": items})
}

func CreateRecurring(c *gin.Context) {
	userID := c.GetString("userID")

	var req CreateRecurringRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify category
	var cat models.Category
	if err := database.DB.Where("id = ? AND user_id = ?", req.CategoryID, userID).First(&cat).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category not found"})
		return
	}

	nextRun := time.Now()
	if req.StartDate != nil {
		nextRun = *req.StartDate
	}

	rule := models.RecurringTransaction{
		UserID:        userID,
		Amount:        req.Amount,
		Type:          req.Type,
		CategoryID:    req.CategoryID,
		PaymentMethod: req.PaymentMethod,
		Note:          req.Note,
		Frequency:     req.Frequency,
		NextRun:       nextRun,
		IsActive:      true,
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create recurring rule"})
		return
	}

	database.DB.Preload("Category").First(&rule, "id = ?", rule.ID)
	c.JSON(http.StatusCreated, gin.H{"recurring": rule})
}

func ToggleRecurring(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var rule models.RecurringTransaction
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring rule not found"})
		return
	}

	rule.IsActive = !rule.IsActive
	if err := database.DB.Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recurring rule status updated", "is_active": rule.IsActive})
}

func DeleteRecurring(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var rule models.RecurringTransaction
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring rule not found"})
		return
	}

	if err := database.DB.Delete(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete recurring rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recurring rule deleted successfully"})
}

func ProcessDueRecurring(c *gin.Context) {
	userID := c.GetString("userID")
	now := time.Now()

	var dueRules []models.RecurringTransaction
	database.DB.Where("user_id = ? AND is_active = ? AND next_run <= ?", userID, true, now).Find(&dueRules)

	createdCount := 0
	for _, rule := range dueRules {
		// 1. Create the transaction
		tx := models.Transaction{
			UserID:        rule.UserID,
			Amount:        rule.Amount,
			Type:          rule.Type,
			CategoryID:    rule.CategoryID,
			PaymentMethod: rule.PaymentMethod,
			Note:          "[Auto] " + rule.Note,
			Date:          rule.NextRun,
		}
		database.DB.Create(&tx)
		createdCount++

		// 2. Advance next_run
		var nextRun time.Time
		switch rule.Frequency {
		case "daily":
			nextRun = rule.NextRun.AddDate(0, 0, 1)
		case "weekly":
			nextRun = rule.NextRun.AddDate(0, 0, 7)
		case "monthly":
			nextRun = rule.NextRun.AddDate(0, 1, 0)
		default:
			nextRun = rule.NextRun.AddDate(0, 1, 0)
		}
		rule.NextRun = nextRun
		database.DB.Save(&rule)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":               "Recurring transactions processed",
		"created_transactions": createdCount,
	})
}

