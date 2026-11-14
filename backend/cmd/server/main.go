package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"income-expense-backend/internal/database"
	"income-expense-backend/internal/handlers"
	"income-expense-backend/internal/middleware"
)

func main() {
	// Initialize database
	database.InitDB()

	// Gin Engine
	r := gin.Default()

	// CORS Configuration (Essential for Next.js and Capacitor mobile apps)
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true // dynamically reflects request origin to allow credentials
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health Check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC(),
			"service":   "income-expense-backend",
		})
	})

	api := r.Group("/api")
	{
		// Auth Routes (Public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
			auth.POST("/refresh", handlers.RefreshToken)
		}

		// Protected Routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// Profile
			protected.GET("/auth/profile", handlers.GetProfile)
			protected.PUT("/auth/profile", handlers.UpdateProfile)

			// Categories
			protected.GET("/categories", handlers.GetCategories)
			protected.POST("/categories", handlers.CreateCategory)
			protected.DELETE("/categories/:id", handlers.DeleteCategory)

			// Transactions (Cash In & Cash Out)
			protected.GET("/transactions", handlers.ListTransactions)
			protected.POST("/transactions", handlers.CreateTransaction)
			protected.GET("/transactions/:id", handlers.GetTransaction)
			protected.PUT("/transactions/:id", handlers.UpdateTransaction)
			protected.DELETE("/transactions/:id", handlers.DeleteTransaction)

			// Budgets & Category Spending Limits
			protected.GET("/budgets", handlers.GetBudgets)
			protected.POST("/budgets", handlers.SetBudget)
			protected.DELETE("/budgets/:id", handlers.DeleteBudget)

			// Recurring Transactions
			protected.GET("/recurring", handlers.ListRecurring)
			protected.POST("/recurring", handlers.CreateRecurring)
			protected.PUT("/recurring/:id/toggle", handlers.ToggleRecurring)
			protected.DELETE("/recurring/:id", handlers.DeleteRecurring)
			protected.POST("/recurring/process", handlers.ProcessDueRecurring)

			// Analytics & Summary
			protected.GET("/analytics/summary", handlers.GetSummary)
			protected.GET("/analytics/categories", handlers.GetCategoryBreakdown)
			protected.GET("/analytics/trends", handlers.GetMonthlyTrends)

			// Backup & Restore
			protected.GET("/backup/export", handlers.ExportBackup)
			protected.POST("/backup/import", handlers.ImportBackup)
			protected.POST("/backup/log", handlers.RecordBackupLog)
			protected.GET("/backup/history", handlers.GetBackupHistory)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Income & Expense Go API server starting on :%s ...\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

