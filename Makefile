.PHONY: all backend frontend dev test build-android open-android

# Run Go Backend API
backend:
	@echo "Starting Go Backend API on :8080..."
	@cd backend && go run cmd/server/main.go

# Run Next.js Frontend Dev Server
frontend:
	@echo "Starting Next.js Frontend on :3000..."
	@cd frontend && npm run dev

# Run Integration Tests
test:
	@echo "Running Backend API Integration Tests..."
	@bash backend/test_api.sh

# Build Next.js Static Export & Sync to Native Android
build-android:
	@echo "Building Next.js and syncing to Android project..."
	@cd frontend && npm run build && npx cap sync android
	@echo "Android assets updated successfully in frontend/android!"

# Open project in Android Studio
open-android:
	@cd frontend && npx cap open android
