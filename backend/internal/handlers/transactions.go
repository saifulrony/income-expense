package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type CreateTransactionRequest struct {
	AccountID     *string                `json:"account_id"`
	Amount        float64                `json:"amount" binding:"required,gt=0"`
	Type          models.TransactionType `json:"type" binding:"required,oneof=income expense"`
	CategoryID    string                 `json:"category_id" binding:"required"`
	PaymentMethod string                 `json:"payment_method"`
	Note          string                 `json:"note"`
	ReceiptImage  string                 `json:"receipt_image"`
	Date          *string                `json:"date"`
}

type UpdateTransactionRequest struct {
	AccountID     *string                `json:"account_id"`
	Amount        float64                `json:"amount" binding:"required,gt=0"`
	Type          models.TransactionType `json:"type" binding:"required,oneof=income expense"`
	CategoryID    string                 `json:"category_id" binding:"required"`
	PaymentMethod string                 `json:"payment_method"`
	Note          string                 `json:"note"`
	ReceiptImage  string                 `json:"receipt_image"`
	Date          *string                `json:"date"`
}

func parseTransactionDate(dateStr *string) *time.Time {
	if dateStr == nil || *dateStr == "" {
		return nil
	}
	s := *dateStr
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return &t
		}
	}
	return nil
}

func CreateTransaction(c *gin.Context) {
	userID := c.GetString("userID")

	var req CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify category exists and belongs to user
	var category models.Category
	if err := database.DB.Where("id = ? AND user_id = ?", req.CategoryID, userID).First(&category).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	// Resolve target account (Personal, Family, etc.)
	var assignedAccountID *string
	if req.AccountID != nil && *req.AccountID != "" {
		var acc models.Account
		if err := database.DB.Where("id = ? AND user_id = ?", *req.AccountID, userID).First(&acc).Error; err == nil {
			assignedAccountID = &acc.ID
		}
	}
	if assignedAccountID == nil {
		var defaultAcc models.Account
		if err := database.DB.Where("user_id = ?", userID).Order("is_default desc, created_at asc").First(&defaultAcc).Error; err == nil {
			assignedAccountID = &defaultAcc.ID
		}
	}

	txDate := time.Now()
	if parsed := parseTransactionDate(req.Date); parsed != nil {
		txDate = *parsed
	}

	paymentMethod := req.PaymentMethod
	if paymentMethod == "" {
		paymentMethod = "Cash"
	}

	tx := models.Transaction{
		UserID:        userID,
		AccountID:     assignedAccountID,
		Amount:        req.Amount,
		Type:          req.Type,
		CategoryID:    req.CategoryID,
		PaymentMethod: paymentMethod,
		Note:          req.Note,
		ReceiptImage:  req.ReceiptImage,
		Date:          txDate,
	}

	if err := database.DB.Create(&tx).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction"})
		return
	}

	// Preload category and account for response
	database.DB.Preload("Category").Preload("Account").First(&tx, "id = ?", tx.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Transaction recorded successfully",
		"transaction": tx,
	})
}

func ListTransactions(c *gin.Context) {
	userID := c.GetString("userID")

	// Query params
	accountID := c.Query("account_id")
	txType := c.Query("type") // income or expense
	categoryID := c.Query("category_id")
	paymentMethod := c.Query("payment_method")
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	search := c.Query("search")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := database.DB.Model(&models.Transaction{}).
		Where("transactions.user_id = ?", userID).
		Preload("Category").
		Preload("Account")

	if accountID != "" && accountID != "all" {
		query = query.Where("transactions.account_id = ?", accountID)
	}
	if txType != "" {
		query = query.Where("transactions.type = ?", txType)
	}
	if categoryID != "" {
		query = query.Where("transactions.category_id = ?", categoryID)
	}
	if paymentMethod != "" {
		query = query.Where("transactions.payment_method = ?", paymentMethod)
	}
	if startDateStr != "" {
		if startDate, err := time.Parse("2006-01-02", startDateStr); err == nil {
			query = query.Where("transactions.date >= ?", startDate)
		}
	}
	if endDateStr != "" {
		if endDate, err := time.Parse("2006-01-02", endDateStr); err == nil {
			// end of day
			query = query.Where("transactions.date <= ?", endDate.Add(24*time.Hour-time.Nanosecond))
		}
	}
	if search != "" {
		query = query.Joins("LEFT JOIN categories ON categories.id = transactions.category_id").
			Where("transactions.note LIKE ? OR categories.name LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var totalCount int64
	query.Count(&totalCount)

	var transactions []models.Transaction
	if err := query.Order("transactions.date DESC, transactions.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transactions": transactions,
		"pagination": gin.H{
			"current_page": page,
			"per_page":     limit,
			"total_items":  totalCount,
			"total_pages":  (totalCount + int64(limit) - 1) / int64(limit),
		},
	})
}

func GetTransaction(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var tx models.Transaction
	if err := database.DB.Preload("Category").Preload("Account").Where("id = ? AND user_id = ?", id, userID).First(&tx).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transaction": tx})
}

func UpdateTransaction(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var tx models.Transaction
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&tx).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	var req UpdateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify category
	var category models.Category
	if err := database.DB.Where("id = ? AND user_id = ?", req.CategoryID, userID).First(&category).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	if req.AccountID != nil && *req.AccountID != "" {
		var acc models.Account
		if err := database.DB.Where("id = ? AND user_id = ?", *req.AccountID, userID).First(&acc).Error; err == nil {
			tx.AccountID = &acc.ID
		}
	}

	tx.Amount = req.Amount
	tx.Type = req.Type
	tx.CategoryID = req.CategoryID
	if req.PaymentMethod != "" {
		tx.PaymentMethod = req.PaymentMethod
	}
	tx.Note = req.Note
	if req.ReceiptImage != "" {
		tx.ReceiptImage = req.ReceiptImage
	}
	if parsed := parseTransactionDate(req.Date); parsed != nil {
		tx.Date = *parsed
	}

	if err := database.DB.Save(&tx).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update transaction"})
		return
	}

	database.DB.Preload("Category").Preload("Account").First(&tx, "id = ?", tx.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":     "Transaction updated successfully",
		"transaction": tx,
	})
}

func DeleteTransaction(c *gin.Context) {
	userID := c.GetString("userID")
	id := c.Param("id")

	var tx models.Transaction
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&tx).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	if err := database.DB.Delete(&tx).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted successfully"})
}

