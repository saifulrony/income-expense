package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type CreateCategoryRequest struct {
	Name  string                 `json:"name" binding:"required"`
	Type  models.TransactionType `json:"type" binding:"required,oneof=income expense"`
	Icon  string                 `json:"icon"`
	Color string                 `json:"color"`
}

func GetCategories(c *gin.Context) {
	userID := c.GetString("userID")
	categoryType := c.Query("type") // optional filter: "income" or "expense"

	query := database.DB.Where("user_id = ?", userID)
	if categoryType != "" {
		query = query.Where("type = ?", categoryType)
	}

	var categories []models.Category
	if err := query.Order("name ASC").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

func CreateCategory(c *gin.Context) {
	userID := c.GetString("userID")

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	icon := req.Icon
	if icon == "" {
		icon = "Tag"
	}

	color := req.Color
	if color == "" {
		if req.Type == models.TypeIncome {
			color = "#10B981"
		} else {
			color = "#EF4444"
		}
	}

	category := models.Category{
		UserID: userID,
		Name:   req.Name,
		Type:   req.Type,
		Icon:   icon,
		Color:  color,
	}

	if err := database.DB.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"category": category})
}

func DeleteCategory(c *gin.Context) {
	userID := c.GetString("userID")
	categoryID := c.Param("id")

	var category models.Category
	if err := database.DB.Where("id = ? AND user_id = ?", categoryID, userID).First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	if err := database.DB.Delete(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category deleted successfully"})
}

