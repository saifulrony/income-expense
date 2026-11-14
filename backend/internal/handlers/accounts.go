package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type AccountResponse struct {
	ID               string  `json:"id"`
	UserID           string  `json:"user_id"`
	Name             string  `json:"name"`
	Type             string  `json:"type"`
	Icon             string  `json:"icon"`
	Color            string  `json:"color"`
	IsDefault        bool    `json:"is_default"`
	TotalIncome      float64 `json:"total_income"`
	TotalExpense     float64 `json:"total_expense"`
	Balance          float64 `json:"balance"`
	TransactionCount int64   `json:"transaction_count"`
	CreatedAt        string  `json:"created_at"`
}

type CreateAccountRequest struct {
	Name      string `json:"name" binding:"required"`
	Type      string `json:"type"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	IsDefault bool   `json:"is_default"`
}

type UpdateAccountRequest struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	IsDefault bool   `json:"is_default"`
}

// GetAccounts returns all accounts for the authenticated user along with their balances
func GetAccounts(c *gin.Context) {
	userID := c.GetString("userID")

	var accounts []models.Account
	if err := database.DB.Where("user_id = ?", userID).Order("is_default desc, created_at asc").Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch accounts"})
		return
	}

	// If no accounts exist yet, seed default ones
	if len(accounts) == 0 {
		p, f, _ := database.SeedDefaultAccounts(database.DB, userID)
		accounts = []models.Account{p, f}
	}

	var results []AccountResponse
	for _, acc := range accounts {
		var inc, exp float64
		var count int64

		database.DB.Model(&models.Transaction{}).
			Where("user_id = ? AND account_id = ? AND type = ?", userID, acc.ID, models.TypeIncome).
			Select("COALESCE(SUM(amount), 0)").Scan(&inc)

		database.DB.Model(&models.Transaction{}).
			Where("user_id = ? AND account_id = ? AND type = ?", userID, acc.ID, models.TypeExpense).
			Select("COALESCE(SUM(amount), 0)").Scan(&exp)

		database.DB.Model(&models.Transaction{}).
			Where("user_id = ? AND account_id = ?", userID, acc.ID).
			Count(&count)

		results = append(results, AccountResponse{
			ID:               acc.ID,
			UserID:           acc.UserID,
			Name:             acc.Name,
			Type:             acc.Type,
			Icon:             acc.Icon,
			Color:            acc.Color,
			IsDefault:        acc.IsDefault,
			TotalIncome:      inc,
			TotalExpense:     exp,
			Balance:          inc - exp,
			TransactionCount: count,
			CreatedAt:        acc.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	c.JSON(http.StatusOK, gin.H{"accounts": results})
}

// CreateAccount creates a new sub-account (e.g. "Personal", "Family", "Business")
func CreateAccount(c *gin.Context) {
	userID := c.GetString("userID")

	var req CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Account name cannot be empty"})
		return
	}

	// Check for duplicate account name for this user
	var existing models.Account
	if err := database.DB.Where("user_id = ? AND LOWER(name) = ?", userID, strings.ToLower(name)).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this name already exists"})
		return
	}

	accountType := req.Type
	if accountType == "" {
		accountType = "personal"
	}

	icon := req.Icon
	if icon == "" {
		icon = "Wallet"
	}

	color := req.Color
	if color == "" {
		color = "#10B981"
	}

	// If this new account is marked as default, unset other defaults
	if req.IsDefault {
		database.DB.Model(&models.Account{}).Where("user_id = ?", userID).Update("is_default", false)
	}

	acc := models.Account{
		UserID:    userID,
		Name:      name,
		Type:      accountType,
		Icon:      icon,
		Color:     color,
		IsDefault: req.IsDefault,
	}

	if err := database.DB.Create(&acc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Account created successfully",
		"account": AccountResponse{
			ID:               acc.ID,
			UserID:           acc.UserID,
			Name:             acc.Name,
			Type:             acc.Type,
			Icon:             acc.Icon,
			Color:            acc.Color,
			IsDefault:        acc.IsDefault,
			Balance:          0,
			TotalIncome:      0,
			TotalExpense:     0,
			TransactionCount: 0,
			CreatedAt:        acc.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
	})
}

// UpdateAccount updates an existing sub-account's properties
func UpdateAccount(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Param("id")

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var acc models.Account
	if err := database.DB.Where("id = ? AND user_id = ?", accountID, userID).First(&acc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = strings.TrimSpace(req.Name)
	}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.Icon != "" {
		updates["icon"] = req.Icon
	}
	if req.Color != "" {
		updates["color"] = req.Color
	}
	if req.IsDefault {
		database.DB.Model(&models.Account{}).Where("user_id = ?", userID).Update("is_default", false)
		updates["is_default"] = true
	}

	if err := database.DB.Model(&acc).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account updated successfully"})
}

// DeleteAccountItem removes a sub-account and moves its transactions to the default account
func DeleteAccountItem(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Param("id")

	var acc models.Account
	if err := database.DB.Where("id = ? AND user_id = ?", accountID, userID).First(&acc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	// Verify user has more than 1 account
	var totalAccounts int64
	database.DB.Model(&models.Account{}).Where("user_id = ?", userID).Count(&totalAccounts)
	if totalAccounts <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your only account. You must have at least one account."})
		return
	}

	// Find the user's default or another fallback account
	var fallbackAccount models.Account
	if err := database.DB.Where("user_id = ? AND id != ?", userID, accountID).
		Order("is_default desc, created_at asc").
		First(&fallbackAccount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find fallback account"})
		return
	}

	tx := database.DB.Begin()

	// Reassign transactions to fallback account to avoid losing user financial history
	if err := tx.Model(&models.Transaction{}).
		Where("user_id = ? AND account_id = ?", userID, accountID).
		Update("account_id", fallbackAccount.ID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reassign transactions"})
		return
	}

	// Delete the account
	if err := tx.Delete(&acc).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Account deleted successfully. Its transactions have been merged into " + fallbackAccount.Name,
	})
}
