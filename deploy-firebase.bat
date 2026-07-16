@echo off
echo ============================================
echo   PoultryLog NG - Deploy to Firebase
echo ============================================
echo.

echo [1/3] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed! Aborting deployment.
    pause
    exit /b 1
)

echo.
echo [2/3] Deploying to Firebase Hosting...
call npx firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo Deployment failed! Check your Firebase configuration.
    echo Make sure you have run: npx firebase login
    echo And that firebase.json exists in the project root.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Deployment Complete!
echo ============================================
echo.
pause
