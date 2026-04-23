# PowerShell script for backend deployment
$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$InfrastructureDir = Join-Path $ScriptDir "infrastructure"

# Stack name (can be overridden via environment variable)
$StackName = if ($env:STACK_NAME) { $env:STACK_NAME } else { "AppStack" }

Write-Host "🚀 Starting backend deployment..." -ForegroundColor Cyan
Write-Host "📦 Stack name: $StackName" -ForegroundColor Cyan

# Navigate to the backend directory
Set-Location $BackendDir

# Install dependencies if needed
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
npm install

# Prepare Lambda packages with dependencies
Write-Host "📦 Preparing Lambda packages with dependencies..." -ForegroundColor Yellow
& "$BackendDir\scripts\prepare-lambda-packages.ps1"

# Build the backend
Write-Host "🔨 Building backend..." -ForegroundColor Yellow
npm run build

# Navigate to infrastructure directory
Set-Location $InfrastructureDir

# Install dependencies if needed
Write-Host "📦 Installing infrastructure dependencies..." -ForegroundColor Yellow
npm install

# Make sure @types/node is installed
Write-Host "📦 Ensuring @types/node is installed..." -ForegroundColor Yellow
npm install --save-dev @types/node

# Build the infrastructure code
Write-Host "🔨 Building infrastructure code..." -ForegroundColor Yellow
npm run build

# Deploy backend infrastructure using CDK
Write-Host "🏗️ Deploying backend infrastructure..." -ForegroundColor Yellow

# Bootstrap CDK environment (idempotent - safe to run multiple times)
Write-Host "🔧 Ensuring CDK environment is bootstrapped..." -ForegroundColor Yellow
npx cdk bootstrap

npx cdk deploy $StackName --require-approval never

Write-Host "✅ Backend deployment completed successfully!" -ForegroundColor Green
