package database

import (
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"income-expense-backend/internal/models"
)

var DB *gorm.DB

func InitDB() *gorm.DB {
	dbDir := "./data"
	if err := os.MkdirAll(dbDir, os.ModePerm); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	dbPath := filepath.Join(dbDir, "income_expense.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate schema
	err = db.AutoMigrate(
		&models.User{},
		&models.Category{},
		&models.Transaction{},
		&models.Budget{},
		&models.RecurringTransaction{},
		&models.BackupLog{},
	)
	if err != nil {
		log.Fatalf("Failed to auto-migrate database: %v", err)
	}

	DB = db
	log.Println("Database connection established & schema migrated successfully.")
	return DB
}

func SeedDefaultCategories(db *gorm.DB, userID string) error {
	defaultCategories := []models.Category{
		// Income categories (Cash In)
		{UserID: userID, Name: "Salary", Type: models.TypeIncome, Icon: "Briefcase", Color: "#10B981", IsDefault: true},
		{UserID: userID, Name: "Business", Type: models.TypeIncome, Icon: "TrendingUp", Color: "#059669", IsDefault: true},
		{UserID: userID, Name: "Freelance", Type: models.TypeIncome, Icon: "Laptop", Color: "#34D399", IsDefault: true},
		{UserID: userID, Name: "Investments", Type: models.TypeIncome, Icon: "DollarSign", Color: "#047857", IsDefault: true},
		{UserID: userID, Name: "Gifts / Bonus", Type: models.TypeIncome, Icon: "Gift", Color: "#6EE7B7", IsDefault: true},
		{UserID: userID, Name: "Other Income", Type: models.TypeIncome, Icon: "PlusCircle", Color: "#A7F3D0", IsDefault: true},

		// Expense categories (Cash Out)
		{UserID: userID, Name: "Food & Dining", Type: models.TypeExpense, Icon: "Utensils", Color: "#EF4444", IsDefault: true},
		{UserID: userID, Name: "Rent & Housing", Type: models.TypeExpense, Icon: "Home", Color: "#DC2626", IsDefault: true},
		{UserID: userID, Name: "Transportation", Type: models.TypeExpense, Icon: "Car", Color: "#F97316", IsDefault: true},
		{UserID: userID, Name: "Utilities & Bills", Type: models.TypeExpense, Icon: "Zap", Color: "#EA580C", IsDefault: true},
		{UserID: userID, Name: "Shopping", Type: models.TypeExpense, Icon: "ShoppingBag", Color: "#EC4899", IsDefault: true},
		{UserID: userID, Name: "Healthcare", Type: models.TypeExpense, Icon: "Activity", Color: "#E11D48", IsDefault: true},
		{UserID: userID, Name: "Entertainment", Type: models.TypeExpense, Icon: "Film", Color: "#8B5CF6", IsDefault: true},
		{UserID: userID, Name: "Education", Type: models.TypeExpense, Icon: "BookOpen", Color: "#6366F1", IsDefault: true},
		{UserID: userID, Name: "Other Expense", Type: models.TypeExpense, Icon: "MinusCircle", Color: "#9CA3AF", IsDefault: true},
	}

	for _, cat := range defaultCategories {
		var existing models.Category
		if err := db.Where("user_id = ? AND name = ? AND type = ?", userID, cat.Name, cat.Type).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&cat).Error; err != nil {
					return err
				}
			}
		}
	}
	return nil
}

