# Antigravity Feature Specification: In Dashboard I would like to be able to click on the theta value to see which positions...

> **Source**: Telegram "App" Topic (Message ID: 26)  
> **Received At**: Sep 7, 2026, 11:05 PM  
> **Topic**: `App`  
> **Category**: `Feature`  
> **Status**: FULFILLED (Completed by Antigravity)

---

## 1. Feature Goal & User Request
In Dashboard I would like to be able to click on the theta value to see which positions...

In Dashboard I would like to be able to click on the theta value to see which positions provide this theta

---

## 2. Technical Stack & Environment Context
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, Radix UI, TanStack React Query.
- **Backend**: Node.js, Express, TypeScript (`tsx watch server/index.ts`).
- **Database**: SQLite with Prisma ORM (`prisma/schema.prisma`).
- **Target Components**: 
  - `src/components/dashboard/ThetaBreakdownModal.tsx` [NEW]
  - `src/components/dashboard/ExecutiveStatsRibbon.tsx` [MODIFIED]
  - `src/components/Dashboard.tsx` [MODIFIED]
  - `src/components/portfolio/PortfolioSummary.tsx` [MODIFIED]
  - `src/utils/greeksUtils.ts` [MODIFIED]

---

## 3. Implementation Summary
1. **Interactive Theta Card**: Added `onOpenThetaBreakdown` to `ExecutiveStatsRibbon` and wrapped Card 3 (Portfolio Theta) with cursor-pointer, purple hover styling, breakdown badge affordance, and tooltip. Also made the collapsed top balances Theta badge clickable.
2. **Dedicated Theta Breakdown Modal**: Created `ThetaBreakdownModal` displaying:
   - Overall Portfolio Theta metrics ($/day, $/mo, yield %, regime status).
   - Cash-Flow Comparison Bar (Short Options Harvest vs Long Options Decay Drag).
   - Real-time search and filter chips (Short, Long, Calls, Puts, ≤14 DTE).
   - Sorting by highest income, highest decay cost, DTE, quantity, and symbol.
   - Comprehensive contract cards with DTE warning pills, moneyness (ITM/OTM), broker tag, and P&L.
   - Direct action buttons for ticker Research and AI Position Defense Advisor.
3. **Automated Verification**:
   - Passed all unit tests in `src/test/thetaBreakdownModal.test.tsx` and `src/test/dashboardThetaClick.test.tsx`.
   - Verified TypeScript compilation and production build (`npm run build`).

---

*Spec fulfilled autonomously by Antigravity AI Coding Agent.*
