package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TransactionType string

const (
	TypeIncome  TransactionType = "income"
	TypeExpense TransactionType = "expense"
)

type User struct {
	ID           string        `gorm:"primaryKey;size:36" json:"id"`
	Email        string        `gorm:"uniqueIndex;not null;size:191" json:"email"`
	PasswordHash string        `gorm:"not null" json:"-"`
	FullName     string        `gorm:"size:100" json:"full_name"`
	Currency     string        `gorm:"size:10;default:'USD'" json:"currency"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	Categories   []Category    `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"categories,omitempty"`
	Transactions []Transaction `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"transactions,omitempty"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return
}

type Category struct {
	ID        string          `gorm:"primaryKey;size:36" json:"id"`
	UserID    string          `gorm:"index;size:36;not null" json:"user_id"`
	Name      string          `gorm:"not null;size:100" json:"name"`
	Type      TransactionType `gorm:"not null;size:20" json:"type"` // income or expense
	Icon      string          `gorm:"size:50;default:'Tag'" json:"icon"`
	Color     string          `gorm:"size:20;default:'#3B82F6'" json:"color"`
	IsDefault bool            `gorm:"default:false" json:"is_default"`
	CreatedAt time.Time       `json:"created_at"`
}

func (c *Category) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return
}

type Transaction struct {
	ID            string          `gorm:"primaryKey;size:36" json:"id"`
	UserID        string          `gorm:"index;size:36;not null" json:"user_id"`
	Amount        float64         `gorm:"type:decimal(15,2);not null" json:"amount"`
	Type          TransactionType `gorm:"not null;size:20" json:"type"` // income (Cash In) or expense (Cash Out)
	CategoryID    string          `gorm:"index;size:36;not null" json:"category_id"`
	Category      Category        `gorm:"foreignKey:CategoryID" json:"category"`
	PaymentMethod string          `gorm:"size:50;default:'Cash'" json:"payment_method"` // Cash, Bank, Mobile Wallet
	Note          string          `gorm:"type:text" json:"note"`
	Date          time.Time       `gorm:"not null;index" json:"date"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

func (t *Transaction) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return
}

type BackupLog struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	UserID     string    `gorm:"index;size:36;not null" json:"user_id"`
	Provider   string    `gorm:"size:50;default:'google_drive'" json:"provider"`
	FileID     string    `gorm:"size:255" json:"file_id"`
	FileName   string    `gorm:"size:255" json:"file_name"`
	RecordSize int       `json:"record_size"`
	Status     string    `gorm:"size:50;default:'completed'" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

func (b *BackupLog) BeforeCreate(tx *gorm.DB) (err error) {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return
}
