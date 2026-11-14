package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type SetBudgetRequest struct {
	CategoryID string  `json:"category_id" binding:"required"`
	Amount     float64 `json:"amount" binding:"required,gt=0"`
	Month      string  `json:"month"` // "YYYY-MM", defaults to current month
}

type BudgetStatusItem struct {
	BudgetID       string          `json:"budget_id"`
	CategoryID     string          `json:"category_id"`
	CategoryName   string          `json:"category_name"`
	CategoryIcon   string          `json:"category_icon"`
	CategoryColor  string          `json:"category_color"`
	BudgetLimit    float64         `json:"budget_limit"`
	ActualSpent    float64         `json:"actual_spent"`
	Remaining      float64         `json:"remaining"`
	Percentage     float64         `json:"percentage"`
	Status         string          `json:"status"` // safe (<80%), warning (80-100%), exceeded (>100%)
	Month          string          `json:"month"`
}

func GetBudgets(c *gin.Context) {
	userID := c.GetString("userID")
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	var budgets []models.Budget
	if err := database.DB.Preload("Category").Where("user_id = ? AND month = ?", userID, month).Find(&budgets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch budgets"})
		return
	}

	// Calculate start and end of that month
	startOfMonth, err := time.Parse("2006-01", month)
	if err != nil {
		startOfMonth = time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)

	var items []BudgetStatusItem
	var totalBudget, totalSpent float64

	for _, b := range budgets {
		var spent float64
		database.DB.Model(&models.Transaction{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND category_id = ? AND type = ? AND date >= ? AND date <= ?",
				userID, b.CategoryID, models.TypeExpense, startOfMonth, endOfMonth).
			Scan(&spent)

		pct := 0.0
		if b.Amount > 0 {
			pct = (spent / b.Amount) * 100.0
		}

		status := "safe"
		if pct >= 100.0 {
			status = "exceeded"
		} else if pct >= 80.0 {
			status = "warning"
		}

		items = append(items, BudgetStatusItem{
			BudgetID:      b.ID,
			CategoryID:    b.CategoryID,
			CategoryName:  b.Category.Name,
			CategoryIcon:  b.Category.Icon,
			CategoryColor: b.Category.Color,
			BudgetLimit:   b.Amount,
			ActualSpent:   spent,
			Remaining:     b.Amount - spent,
			Percentage:    pct,
			Status:        status,
			Month:         b.Month,
		})

		totalBudget += b.Amount
		totalSpent += spent
	}

	overallPct := 0.0
	if totalBudget > 0 {
		overallPct = (totalSpent / totalBudget) * 100.0
	}

	c.JSON(http.StatusOK, gin.H{
		"month":         month,
		"total_budget":  totalBudget,
		"total_spent":   totalSpent,
		"remaining":     totalBudget - totalSpent,
		"percentage":    overallPct,
		"budgets":       items,
	})
}

func SetBudget(c *gin.Context) {
	userID := c.GetString("userID")

	var req SetBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Month == "" {
		req.Month = time.Now().Format("2006-01")
	}

	// Verify category exists and is an expense category
	var category models.Category
	if err := database.DB.Where("id = ? AND user_id = ?", req.CategoryID, userID).First(&category).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category not found"})
		return
	}

	// Upsert budget
	var existing models.Budget
	err := database.DB.Where("user_id = ? AND category_id = ? AND month = ?", userID, req.CategoryID, req.Month).First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		budget := models.Budget{
			UserID:     userID,
			CategoryID: req.CategoryID,
			Amount:     req.Amount,
			Month:      req.Month,
		}
		if err := database.DB.Create(&budget).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create budget"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "Budget set successfully", "budget": budget})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	existing.Amount = req.Amount
	if err := database.DB.Save(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update budget"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Budget updated successfully", "budget": existing})
}

func DeleteBudget(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var budget models.Budget
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&budget).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Budget not found"})
		return
	}

	if err := database.DB.Delete(&budget).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete budget"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Budget removed successfully"})
}

