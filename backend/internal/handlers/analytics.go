package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"income-expense-backend/internal/database"
	"income-expense-backend/internal/models"
)

type SummaryResponse struct {
	TotalIncome  float64 `json:"total_income"`  // Cash In
	TotalExpense float64 `json:"total_expense"` // Cash Out
	NetBalance   float64 `json:"net_balance"`   // Cash In - Cash Out
	IncomeCount  int64   `json:"income_count"`
	ExpenseCount int64   `json:"expense_count"`
	TotalCount   int64   `json:"total_count"`
	Period       string  `json:"period"`
}

type CategoryAggregate struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Type         string  `json:"type"`
	Color        string  `json:"color"`
	Icon         string  `json:"icon"`
	TotalAmount  float64 `json:"total_amount"`
	Percentage   float64 `json:"percentage"`
	Count        int64   `json:"count"`
}

type MonthlyTrendItem struct {
	Month   string  `json:"month"` // e.g. "2025-01"
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

func GetSummary(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Query("account_id")
	period := c.DefaultQuery("period", "all") // all, today, this_week, this_month, this_year, custom
	fromStr := c.Query("from")
	toStr := c.Query("to")

	now := time.Now()
	var startDate, endDate time.Time

	switch period {
	case "today":
		startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endDate = startDate.Add(24*time.Hour - time.Nanosecond)
	case "this_week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		startOfWeek := now.AddDate(0, 0, -weekday+1)
		startDate = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(0, 0, 7).Add(-time.Nanosecond)
	case "this_month":
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(0, 1, 0).Add(-time.Nanosecond)
	case "this_year":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(1, 0, 0).Add(-time.Nanosecond)
	case "custom":
		if fromStr != "" {
			if t, err := time.Parse("2006-01-02", fromStr); err == nil {
				startDate = t
			}
		}
		if toStr != "" {
			if t, err := time.Parse("2006-01-02", toStr); err == nil {
				endDate = t.Add(24*time.Hour - time.Nanosecond)
			}
		}
	}

	// Calculate Cash In (Income)
	var incResult struct {
		Total float64
		Count int64
	}
	qInc := database.DB.Model(&models.Transaction{}).
		Select("COALESCE(SUM(amount), 0) as total, COUNT(id) as count").
		Where("user_id = ? AND type = ?", userID, models.TypeIncome)
	if accountID != "" && accountID != "all" {
		qInc = qInc.Where("account_id = ?", accountID)
	}
	if !startDate.IsZero() {
		qInc = qInc.Where("date >= ?", startDate)
	}
	if !endDate.IsZero() {
		qInc = qInc.Where("date <= ?", endDate)
	}
	qInc.Scan(&incResult)
	totalIncome := incResult.Total
	incomeCount := incResult.Count

	// Calculate Cash Out (Expense)
	var expResult struct {
		Total float64
		Count int64
	}
	qExp := database.DB.Model(&models.Transaction{}).
		Select("COALESCE(SUM(amount), 0) as total, COUNT(id) as count").
		Where("user_id = ? AND type = ?", userID, models.TypeExpense)
	if accountID != "" && accountID != "all" {
		qExp = qExp.Where("account_id = ?", accountID)
	}
	if !startDate.IsZero() {
		qExp = qExp.Where("date >= ?", startDate)
	}
	if !endDate.IsZero() {
		qExp = qExp.Where("date <= ?", endDate)
	}
	qExp.Scan(&expResult)
	totalExpense := expResult.Total
	expenseCount := expResult.Count

	netBalance := totalIncome - totalExpense

	c.JSON(http.StatusOK, SummaryResponse{
		TotalIncome:  totalIncome,
		TotalExpense: totalExpense,
		NetBalance:   netBalance,
		IncomeCount:  incomeCount,
		ExpenseCount: expenseCount,
		TotalCount:   incomeCount + expenseCount,
		Period:       period,
	})
}

func GetCategoryBreakdown(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Query("account_id")
	txType := c.DefaultQuery("type", "expense") // expense or income
	period := c.DefaultQuery("period", "this_month")

	now := time.Now()
	var startDate, endDate time.Time

	switch period {
	case "today":
		startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endDate = startDate.Add(24*time.Hour - time.Nanosecond)
	case "this_month":
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(0, 1, 0).Add(-time.Nanosecond)
	case "this_year":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(1, 0, 0).Add(-time.Nanosecond)
	}

	type RawCategoryResult struct {
		CategoryID   string  `json:"category_id"`
		CategoryName string  `json:"category_name"`
		Type         string  `json:"type"`
		Color        string  `json:"color"`
		Icon         string  `json:"icon"`
		TotalAmount  float64 `json:"total_amount"`
		Count        int64   `json:"count"`
	}

	var rawResults []RawCategoryResult
	query := database.DB.Table("transactions").
		Select("transactions.category_id, categories.name as category_name, categories.type, categories.color, categories.icon, SUM(transactions.amount) as total_amount, COUNT(transactions.id) as count").
		Joins("JOIN categories ON categories.id = transactions.category_id").
		Where("transactions.user_id = ? AND transactions.type = ?", userID, txType)

	if accountID != "" && accountID != "all" {
		query = query.Where("transactions.account_id = ?", accountID)
	}
	if !startDate.IsZero() {
		query = query.Where("transactions.date >= ?", startDate)
	}
	if !endDate.IsZero() {
		query = query.Where("transactions.date <= ?", endDate)
	}

	query.Group("transactions.category_id, categories.name, categories.type, categories.color, categories.icon").
		Order("total_amount DESC").
		Scan(&rawResults)

	var overallTotal float64
	for _, item := range rawResults {
		overallTotal += item.TotalAmount
	}

	var aggregates []CategoryAggregate
	for _, item := range rawResults {
		pct := 0.0
		if overallTotal > 0 {
			pct = (item.TotalAmount / overallTotal) * 100.0
		}
		aggregates = append(aggregates, CategoryAggregate{
			CategoryID:   item.CategoryID,
			CategoryName: item.CategoryName,
			Type:         item.Type,
			Color:        item.Color,
			Icon:         item.Icon,
			TotalAmount:  item.TotalAmount,
			Percentage:   pct,
			Count:        item.Count,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"type":        txType,
		"period":      period,
		"total":       overallTotal,
		"breakdowns": aggregates,
	})
}

func GetMonthlyTrends(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Query("account_id")

	// Last 6 months
	now := time.Now()
	var trends []MonthlyTrendItem

	for i := 5; i >= 0; i-- {
		targetMonth := now.AddDate(0, -i, 0)
		startOfMonth := time.Date(targetMonth.Year(), targetMonth.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)

		monthLabel := startOfMonth.Format("Jan 2006")

		var incTotal, expTotal float64

		qInc := database.DB.Model(&models.Transaction{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND type = ? AND date >= ? AND date <= ?", userID, models.TypeIncome, startOfMonth, endOfMonth)
		if accountID != "" && accountID != "all" {
			qInc = qInc.Where("account_id = ?", accountID)
		}
		qInc.Scan(&incTotal)

		qExp := database.DB.Model(&models.Transaction{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND type = ? AND date >= ? AND date <= ?", userID, models.TypeExpense, startOfMonth, endOfMonth)
		if accountID != "" && accountID != "all" {
			qExp = qExp.Where("account_id = ?", accountID)
		}
		qExp.Scan(&expTotal)

		trends = append(trends, MonthlyTrendItem{
			Month:   monthLabel,
			Income:  incTotal,
			Expense: expTotal,
			Net:     incTotal - expTotal,
		})
	}

	c.JSON(http.StatusOK, gin.H{"trends": trends})
}

type PaymentMethodStat struct {
	Method     string  `json:"method"`
	Amount     float64 `json:"amount"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

type DayOfWeekStat struct {
	Day     string  `json:"day"`     // "Mon", "Tue", ...
	DayNum  int     `json:"day_num"` // 1 (Mon) - 7 (Sun)
	Expense float64 `json:"expense"`
	Income  float64 `json:"income"`
	Count   int64   `json:"count"`
}

type TopTransactionItem struct {
	ID           string    `json:"id"`
	Amount       float64   `json:"amount"`
	Type         string    `json:"type"`
	Note         string    `json:"note"`
	Date         time.Time `json:"date"`
	CategoryName string    `json:"category_name"`
	Color        string    `json:"color"`
	Icon         string    `json:"icon"`
}

type AnalyticsInsightsResponse struct {
	SavingsRate           float64              `json:"savings_rate"`
	SavingsHealth         string               `json:"savings_health"`
	DailyAverageExpense   float64              `json:"daily_average_expense"`
	DailyAverageIncome    float64              `json:"daily_average_income"`
	ProjectedMonthExpense float64              `json:"projected_month_expense"`
	DaysElapsed           int                  `json:"days_elapsed"`
	DaysInPeriod          int                  `json:"days_in_period"`
	ExpenseDiffPct        float64              `json:"expense_diff_pct"`
	IncomeDiffPct         float64              `json:"income_diff_pct"`
	PaymentMethods        []PaymentMethodStat  `json:"payment_methods"`
	DayOfWeekStats        []DayOfWeekStat      `json:"day_of_week_stats"`
	PeakSpendingDay       string               `json:"peak_spending_day"`
	TopExpenses           []TopTransactionItem `json:"top_expenses"`
}

func GetAnalyticsInsights(c *gin.Context) {
	userID := c.GetString("userID")
	accountID := c.Query("account_id")
	period := c.DefaultQuery("period", "this_month") // this_month, today, this_year, all

	now := time.Now()
	var curStart, curEnd, prevStart, prevEnd time.Time
	daysElapsed := 1
	daysInPeriod := 1

	switch period {
	case "today":
		curStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		curEnd = curStart.Add(24*time.Hour - time.Nanosecond)
		prevStart = curStart.AddDate(0, 0, -1)
		prevEnd = curStart.Add(-time.Nanosecond)
		daysElapsed = 1
		daysInPeriod = 1
	case "this_year":
		curStart = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		curEnd = curStart.AddDate(1, 0, 0).Add(-time.Nanosecond)
		prevStart = curStart.AddDate(-1, 0, 0)
		prevEnd = curStart.Add(-time.Nanosecond)
		daysElapsed = now.YearDay()
		daysInPeriod = 365
	case "all":
		daysElapsed = 1
		daysInPeriod = 1
	default: // "this_month"
		curStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		curEnd = curStart.AddDate(0, 1, 0).Add(-time.Nanosecond)
		prevStart = curStart.AddDate(0, -1, 0)
		prevEnd = curStart.Add(-time.Nanosecond)
		daysElapsed = now.Day()
		daysInPeriod = time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Day()
	}

	if daysElapsed < 1 {
		daysElapsed = 1
	}

	// 1. Current period income and expense
	var curIncome, curExpense float64
	qInc := database.DB.Model(&models.Transaction{}).
		Select("COALESCE(SUM(amount), 0)").
		Where("user_id = ? AND type = ?", userID, models.TypeIncome)
	qExp := database.DB.Model(&models.Transaction{}).
		Select("COALESCE(SUM(amount), 0)").
		Where("user_id = ? AND type = ?", userID, models.TypeExpense)

	if accountID != "" && accountID != "all" {
		qInc = qInc.Where("account_id = ?", accountID)
		qExp = qExp.Where("account_id = ?", accountID)
	}
	if !curStart.IsZero() {
		qInc = qInc.Where("date >= ?", curStart)
		qExp = qExp.Where("date >= ?", curStart)
	}
	if !curEnd.IsZero() {
		qInc = qInc.Where("date <= ?", curEnd)
		qExp = qExp.Where("date <= ?", curEnd)
	}
	qInc.Scan(&curIncome)
	qExp.Scan(&curExpense)

	// 2. Previous period income and expense for comparison
	var prevIncome, prevExpense float64
	if !prevStart.IsZero() {
		qPrevInc := database.DB.Model(&models.Transaction{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND type = ? AND date >= ? AND date <= ?", userID, models.TypeIncome, prevStart, prevEnd)
		qPrevExp := database.DB.Model(&models.Transaction{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND type = ? AND date >= ? AND date <= ?", userID, models.TypeExpense, prevStart, prevEnd)
		if accountID != "" && accountID != "all" {
			qPrevInc = qPrevInc.Where("account_id = ?", accountID)
			qPrevExp = qPrevExp.Where("account_id = ?", accountID)
		}
		qPrevInc.Scan(&prevIncome)
		qPrevExp.Scan(&prevExpense)
	}

	var incDiffPct, expDiffPct float64
	if prevIncome > 0 {
		incDiffPct = ((curIncome - prevIncome) / prevIncome) * 100.0
	}
	if prevExpense > 0 {
		expDiffPct = ((curExpense - prevExpense) / prevExpense) * 100.0
	}

	// 3. Savings Rate and Financial Health score
	savingsRate := 0.0
	savingsHealth := "Neutral"
	if curIncome > 0 {
		savingsRate = ((curIncome - curExpense) / curIncome) * 100.0
		if savingsRate >= 40.0 {
			savingsHealth = "High"
		} else if savingsRate >= 20.0 {
			savingsHealth = "Healthy"
		} else if savingsRate >= 0.0 {
			savingsHealth = "Modest"
		} else {
			savingsHealth = "Deficit"
		}
	} else if curExpense > 0 {
		savingsRate = -100.0
		savingsHealth = "Deficit"
	}

	dailyAvgExp := curExpense / float64(daysElapsed)
	dailyAvgInc := curIncome / float64(daysElapsed)
	projectedMonthExp := dailyAvgExp * float64(daysInPeriod)

	// 4. Payment Method breakdown for expenses
	type rawMethod struct {
		Method string  `gorm:"column:payment_method"`
		Amount float64 `gorm:"column:total_amount"`
		Count  int64   `gorm:"column:tx_count"`
	}
	var rawMethods []rawMethod
	qMethods := database.DB.Model(&models.Transaction{}).
		Select("COALESCE(payment_method, 'Cash') as payment_method, SUM(amount) as total_amount, COUNT(id) as tx_count").
		Where("user_id = ? AND type = ?", userID, models.TypeExpense)
	if accountID != "" && accountID != "all" {
		qMethods = qMethods.Where("account_id = ?", accountID)
	}
	if !curStart.IsZero() {
		qMethods = qMethods.Where("date >= ?", curStart)
	}
	if !curEnd.IsZero() {
		qMethods = qMethods.Where("date <= ?", curEnd)
	}
	qMethods.Group("payment_method").Order("total_amount DESC").Scan(&rawMethods)

	var paymentStats []PaymentMethodStat
	for _, m := range rawMethods {
		pct := 0.0
		if curExpense > 0 {
			pct = (m.Amount / curExpense) * 100.0
		}
		methodName := m.Method
		if methodName == "" {
			methodName = "Cash"
		}
		paymentStats = append(paymentStats, PaymentMethodStat{
			Method:     methodName,
			Amount:     m.Amount,
			Count:      m.Count,
			Percentage: pct,
		})
	}

	// 5. Day of Week distribution (Mon through Sun)
	type txForDay struct {
		Date   time.Time
		Amount float64
		Type   string
	}
	var txsInPeriod []txForDay
	qTxs := database.DB.Model(&models.Transaction{}).
		Select("date, amount, type").
		Where("user_id = ?", userID)
	if accountID != "" && accountID != "all" {
		qTxs = qTxs.Where("account_id = ?", accountID)
	}
	if !curStart.IsZero() {
		qTxs = qTxs.Where("date >= ?", curStart)
	}
	if !curEnd.IsZero() {
		qTxs = qTxs.Where("date <= ?", curEnd)
	}
	qTxs.Scan(&txsInPeriod)

	dayNames := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	dayStatsMap := make(map[int]*DayOfWeekStat)
	for i := 1; i <= 7; i++ {
		dayStatsMap[i] = &DayOfWeekStat{
			Day:    dayNames[i-1],
			DayNum: i,
		}
	}

	for _, tx := range txsInPeriod {
		// Go time.Weekday: Sunday=0, Monday=1, ..., Saturday=6
		w := int(tx.Date.Weekday())
		dayNum := w
		if w == 0 {
			dayNum = 7 // Sunday as 7
		}
		if s, ok := dayStatsMap[dayNum]; ok {
			s.Count++
			if tx.Type == string(models.TypeExpense) {
				s.Expense += tx.Amount
			} else {
				s.Income += tx.Amount
			}
		}
	}

	var dayOfWeekList []DayOfWeekStat
	maxSpend := -1.0
	peakDay := "None"
	for i := 1; i <= 7; i++ {
		st := *dayStatsMap[i]
		if st.Expense > maxSpend && st.Expense > 0 {
			maxSpend = st.Expense
			peakDay = st.Day
		}
		dayOfWeekList = append(dayOfWeekList, st)
	}

	// 6. Top 5 Largest Expenses in Period
	type rawTopTx struct {
		ID           string    `gorm:"column:id"`
		Amount       float64   `gorm:"column:amount"`
		Type         string    `gorm:"column:type"`
		Note         string    `gorm:"column:note"`
		Date         time.Time `gorm:"column:date"`
		CategoryName string    `gorm:"column:category_name"`
		Color        string    `gorm:"column:color"`
		Icon         string    `gorm:"column:icon"`
	}
	var rawTopList []rawTopTx
	qTop := database.DB.Table("transactions").
		Select("transactions.id, transactions.amount, transactions.type, transactions.note, transactions.date, categories.name as category_name, categories.color, categories.icon").
		Joins("LEFT JOIN categories ON categories.id = transactions.category_id").
		Where("transactions.user_id = ? AND transactions.type = ?", userID, models.TypeExpense)
	if accountID != "" && accountID != "all" {
		qTop = qTop.Where("transactions.account_id = ?", accountID)
	}
	if !curStart.IsZero() {
		qTop = qTop.Where("transactions.date >= ?", curStart)
	}
	if !curEnd.IsZero() {
		qTop = qTop.Where("transactions.date <= ?", curEnd)
	}
	qTop.Order("transactions.amount DESC").Limit(5).Scan(&rawTopList)

	var topExpenses []TopTransactionItem
	for _, item := range rawTopList {
		cName := item.CategoryName
		if cName == "" {
			cName = "General Expense"
		}
		cColor := item.Color
		if cColor == "" {
			cColor = "#EF4444"
		}
		cIcon := item.Icon
		if cIcon == "" {
			cIcon = "ArrowUpRight"
		}
		topExpenses = append(topExpenses, TopTransactionItem{
			ID:           item.ID,
			Amount:       item.Amount,
			Type:         item.Type,
			Note:         item.Note,
			Date:         item.Date,
			CategoryName: cName,
			Color:        cColor,
			Icon:         cIcon,
		})
	}

	c.JSON(http.StatusOK, AnalyticsInsightsResponse{
		SavingsRate:           savingsRate,
		SavingsHealth:         savingsHealth,
		DailyAverageExpense:   dailyAvgExp,
		DailyAverageIncome:    dailyAvgInc,
		ProjectedMonthExpense: projectedMonthExp,
		DaysElapsed:           daysElapsed,
		DaysInPeriod:          daysInPeriod,
		ExpenseDiffPct:        expDiffPct,
		IncomeDiffPct:         incDiffPct,
		PaymentMethods:        paymentStats,
		DayOfWeekStats:        dayOfWeekList,
		PeakSpendingDay:       peakDay,
		TopExpenses:           topExpenses,
	})
}

