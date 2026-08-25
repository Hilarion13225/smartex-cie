#!/bin/bash

# Fix 1: Remove unused 'icons' variable from ui.tsx
sed -i '/^const icons = /d' src/components/ui.tsx

# Fix 2: Remove unused imports
sed -i '/Badge,/d' src/pages/client/dashboard.tsx
sed -i '/FullScreenLoader/d' src/pages/client/payment-progress.tsx
sed -i '/MOCK_TARIFF_FCFA_PER_KWH/d' src/pages/client/recharge.tsx

# Fix 3: Add end property to ClientLayout tabs
sed -i "s/{ to: '\/app', label: 'Accueil', icon: '🏠' }/{ to: '\/app', label: 'Accueil', icon: '🏠', end: true }/g" src/layouts/ClientLayout.tsx

echo "✅ Fixed TypeScript errors"
