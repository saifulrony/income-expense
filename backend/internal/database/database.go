package database

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
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
		&models.Account{},
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

	// Auto-seed Demo Account
	SeedDemoUser(db)

	// Backfill default accounts for existing users & link legacy transactions
	var allUsers []models.User
	db.Find(&allUsers)
	for _, u := range allUsers {
		_, _, _ = SeedDefaultAccounts(db, u.ID)
	}

	return DB
}

func SeedDemoUser(db *gorm.DB) {
	demoEmail := "demo@incomeexpense.app"
	var existing models.User
	if err := db.Where("email = ?", demoEmail).First(&existing).Error; err == gorm.ErrRecordNotFound {
		hash, _ := bcrypt.GenerateFromPassword([]byte("demo123456"), bcrypt.DefaultCost)
		demoUser := models.User{
			Email:        demoEmail,
			PasswordHash: string(hash),
			FullName:     "Saiful Islam",
			Currency:     "USD",
		}
		if err := db.Create(&demoUser).Error; err == nil {
			_ = SeedDefaultCategories(db, demoUser.ID)

			// Add sample transactions so the dashboard has rich data out-of-the-box
			var salaryCat, foodCat, rentCat models.Category
			db.Where("user_id = ? AND name = ?", demoUser.ID, "Salary").First(&salaryCat)
			db.Where("user_id = ? AND name = ?", demoUser.ID, "Food & Dining").First(&foodCat)
			db.Where("user_id = ? AND name = ?", demoUser.ID, "Rent & Housing").First(&rentCat)

			now := time.Now()
			sampleTxs := []models.Transaction{
				{
					UserID:        demoUser.ID,
					Amount:        4500.00,
					Type:          models.TypeIncome,
					CategoryID:    salaryCat.ID,
					PaymentMethod: "Bank Account",
					Note:          "Monthly Salary Deposit",
					Date:          now.AddDate(0, 0, -2),
				},
				{
					UserID:        demoUser.ID,
					Amount:        1200.00,
					Type:          models.TypeExpense,
					CategoryID:    rentCat.ID,
					PaymentMethod: "Bank Account",
					Note:          "Apartment Rent",
					Date:          now.AddDate(0, 0, -1),
				},
				{
					UserID:        demoUser.ID,
					Amount:        145.50,
					Type:          models.TypeExpense,
					CategoryID:    foodCat.ID,
					PaymentMethod: "Cash",
					Note:          "Weekly Grocery Shopping",
					Date:          now,
				},
			}
			for _, tx := range sampleTxs {
				if tx.CategoryID != "" {
					db.Create(&tx)
				}
			}

			// Add a sample budget
			if foodCat.ID != "" {
				db.Create(&models.Budget{
					UserID:     demoUser.ID,
					CategoryID: foodCat.ID,
					Amount:     500.00,
					Month:      now.Format("2006-01"),
				})
			}
		}
	}
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

		// Expense categories (Cash Out) - Distinct Harmonious Fintech Palette
		{UserID: userID, Name: "Food & Dining", Type: models.TypeExpense, Icon: "Utensils", Color: "#F59E0B", IsDefault: true},
		{UserID: userID, Name: "Rent & Housing", Type: models.TypeExpense, Icon: "Home", Color: "#3B82F6", IsDefault: true},
		{UserID: userID, Name: "Transportation", Type: models.TypeExpense, Icon: "Car", Color: "#10B981", IsDefault: true},
		{UserID: userID, Name: "Utilities & Bills", Type: models.TypeExpense, Icon: "Zap", Color: "#06B6D4", IsDefault: true},
		{UserID: userID, Name: "Shopping", Type: models.TypeExpense, Icon: "ShoppingBag", Color: "#EC4899", IsDefault: true},
		{UserID: userID, Name: "Healthcare", Type: models.TypeExpense, Icon: "Activity", Color: "#EF4444", IsDefault: true},
		{UserID: userID, Name: "Entertainment", Type: models.TypeExpense, Icon: "Film", Color: "#8B5CF6", IsDefault: true},
		{UserID: userID, Name: "Education", Type: models.TypeExpense, Icon: "BookOpen", Color: "#6366F1", IsDefault: true},
		{UserID: userID, Name: "Other Expense", Type: models.TypeExpense, Icon: "MinusCircle", Color: "#64748B", IsDefault: true},
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

// SeedDefaultAccounts seeds "Personal" and "Family" sub-accounts for a user and associates existing unassigned transactions
func SeedDefaultAccounts(db *gorm.DB, userID string) (models.Account, models.Account, error) {
	var personal models.Account
	err := db.Where("user_id = ? AND name = ?", userID, "Personal").First(&personal).Error
	if err == gorm.ErrRecordNotFound {
		personal = models.Account{
			UserID:    userID,
			Name:      "Personal",
			Type:      "personal",
			Icon:      "User",
			Color:     "#10B981", // Emerald
			IsDefault: true,
		}
		db.Create(&personal)
	}

	var family models.Account
	err = db.Where("user_id = ? AND name = ?", userID, "Family").First(&family).Error
	if err == gorm.ErrRecordNotFound {
		family = models.Account{
			UserID:    userID,
			Name:      "Family",
			Type:      "family",
			Icon:      "Users",
			Color:     "#3B82F6", // Blue
			IsDefault: false,
		}
		db.Create(&family)
	}

	// Backfill any transactions for this user that don't have an AccountID assigned
	if personal.ID != "" {
		db.Model(&models.Transaction{}).
			Where("user_id = ? AND (account_id IS NULL OR account_id = '')", userID).
			Update("account_id", personal.ID)
	}

	return personal, family, nil
}
