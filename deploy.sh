#!/bin/bash
# ---------------------------------------------------------------------------
# OpenStore Azure Deployment Script
# Simplifies infrastructure deployment for dev and prod environments.
# ---------------------------------------------------------------------------

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-dev}"
LOCATION="${2:-eastus}"
PROJECT_NAME="openstore"
RESOURCE_GROUP="${PROJECT_NAME}-${ENVIRONMENT}-rg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------

validate_prerequisites() {
  log_info "Validating prerequisites..."

  if ! command -v az &> /dev/null; then
    log_error "Azure CLI is not installed. Install from https://aka.ms/installazurecli"
    exit 1
  fi

  if ! az bicep version &> /dev/null; then
    log_warn "Bicep CLI not found. Installing..."
    az bicep install
  fi

  if ! az account show &> /dev/null; then
    log_error "Not logged into Azure. Run 'az login' first."
    exit 1
  fi

  log_info "Prerequisites validated."
}

# ---------------------------------------------------------------------------
# Get SQL admin password
# ---------------------------------------------------------------------------

get_sql_password() {
  if [ -z "$SQL_ADMIN_PASSWORD" ]; then
    echo -n "Enter SQL admin password: "
    read -s SQL_ADMIN_PASSWORD
    echo
  fi

  if [ -z "$SQL_ADMIN_PASSWORD" ]; then
    log_error "SQL admin password is required."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Create resource group
# ---------------------------------------------------------------------------

create_resource_group() {
  log_info "Creating resource group: $RESOURCE_GROUP"
  az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags "Environment=$ENVIRONMENT" "Project=$PROJECT_NAME" \
    --output none
  log_info "Resource group ready."
}

# ---------------------------------------------------------------------------
# Validate Bicep
# ---------------------------------------------------------------------------

validate_bicep() {
  log_info "Validating Bicep templates..."
  az bicep build --file "$SCRIPT_DIR/infra/main.bicep" --outdir "$SCRIPT_DIR/infra/.build"
  log_info "Bicep validation passed."
}

# ---------------------------------------------------------------------------
# Preview deployment
# ---------------------------------------------------------------------------

preview_deployment() {
  log_info "Running what-if preview..."
  az deployment group what-if \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$SCRIPT_DIR/infra/main.bicep" \
    --parameters "$SCRIPT_DIR/infra/parameters.${ENVIRONMENT}.json" \
    --parameters sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
    --no-pretty-print
}

# ---------------------------------------------------------------------------
# Deploy infrastructure
# ---------------------------------------------------------------------------

deploy_infrastructure() {
  log_info "Deploying infrastructure to $ENVIRONMENT..."
  
  az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$SCRIPT_DIR/infra/main.bicep" \
    --parameters "$SCRIPT_DIR/infra/parameters.${ENVIRONMENT}.json" \
    --parameters sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
    --query "properties.outputs" \
    --output json | tee "$SCRIPT_DIR/infra/outputs-${ENVIRONMENT}.json"

  log_info "Deployment complete!"
}

# ---------------------------------------------------------------------------
# Display outputs
# ---------------------------------------------------------------------------

show_outputs() {
  if [ -f "$SCRIPT_DIR/infra/outputs-${ENVIRONMENT}.json" ]; then
    log_info "Deployment outputs:"
    cat "$SCRIPT_DIR/infra/outputs-${ENVIRONMENT}.json"
  fi
}

# ---------------------------------------------------------------------------
# Build and push containers
# ---------------------------------------------------------------------------

build_and_push() {
  log_info "Building and pushing containers..."

  ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv)
  
  if [ -z "$ACR_NAME" ]; then
    log_warn "Container Registry not found. Skipping container build."
    return
  fi

  az acr login --name "$ACR_NAME"

  for app in api storefront admin vendor; do
    log_info "Building $app..."
    docker build \
      -f "$SCRIPT_DIR/apps/$app/Dockerfile" \
      -t "$ACR_NAME.azurecr.io/openstore/$app:$ENVIRONMENT" \
      "$SCRIPT_DIR"
    
    docker push "$ACR_NAME.azurecr.io/openstore/$app:$ENVIRONMENT"
    log_info "$app pushed to ACR."
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  echo "=================================="
  echo "  OpenStore Azure Deployment"
  echo "  Environment: $ENVIRONMENT"
  echo "  Location: $LOCATION"
  echo "=================================="
  echo

  validate_prerequisites
  get_sql_password
  create_resource_group
  validate_bicep
  preview_deployment

  echo
  read -p "Continue with deployment? (y/N) " -n 1 -r
  echo

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Deployment cancelled."
    exit 0
  fi

  deploy_infrastructure
  show_outputs
  build_and_push

  log_info "All done! Your OpenStore deployment is ready."
}

# Show help
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: ./deploy.sh [environment] [location]"
  echo ""
  echo "Arguments:"
  echo "  environment    dev or prod (default: dev)"
  echo "  location       Azure region (default: eastus)"
  echo ""
  echo "Environment Variables:"
  echo "  SQL_ADMIN_PASSWORD    SQL Server admin password"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh dev eastus"
  echo "  SQL_ADMIN_PASSWORD='MyP@ssw0rd!' ./deploy.sh prod westus"
  exit 0
fi

main
