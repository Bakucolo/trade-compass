import YahooFinance from 'yahoo-finance2';
import { generateJsonCompletion } from './llmFallbackRouter';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
const logToFile = (msg: string) => console.log(msg);

export interface ThematicStockCandidate {
  symbol: string;
  companyName: string;
  thesis: string;
  subCategory?: string;
  marketCapCategory?: string;
  price?: number;
  changePercent?: number;
  marketCap?: number;
  pe?: number;
  sector?: string;
  industry?: string;
  isAlreadyInWatchlist: boolean;
}

export interface ThematicLookupResult {
  topic: string;
  refinedTopicName: string;
  themeDescription: string;
  keyDrivers: string[];
  stocks: ThematicStockCandidate[];
  source: 'ai_agent' | 'thematic_heuristic';
}

export interface ResearchThematicOptions {
  topic: string;
  existingSymbols?: string[];
  customFocus?: string;
  count?: number;
}

/**
 * Curated institutional fallback baskets for major market topics & themes
 * Used when LLM router is offline, rate-limited, or during network disruptions.
 */
interface ThematicPreset {
  refinedName: string;
  description: string;
  drivers: string[];
  stocks: Array<{
    symbol: string;
    companyName: string;
    thesis: string;
    subCategory: string;
    marketCapCategory: string;
  }>;
}

const THEMATIC_KNOWLEDGE_BASE: Record<string, ThematicPreset> = {
  semiconductor: {
    refinedName: 'Semiconductors & Silicon Infrastructure',
    description: 'Mission-critical semiconductor foundries, fabless designers, and capital equipment manufacturers powering the AI compute wave and edge silicon.',
    drivers: ['Hyperscale AI accelerator demand', 'Lithography & packaging bottleneck monetization', 'Automotive & IoT silicon content expansion'],
    stocks: [
      { symbol: 'NVDA', companyName: 'NVIDIA Corp', thesis: 'Monopolistic GPU architecture & CUDA software ecosystem dominating AI data centers.', subCategory: 'AI Accelerators', marketCapCategory: 'Mega Cap' },
      { symbol: 'TSM', companyName: 'Taiwan Semiconductor', thesis: 'Exclusive global foundry leader for sub-3nm cutting-edge compute silicon.', subCategory: 'Foundry & Fab', marketCapCategory: 'Mega Cap' },
      { symbol: 'ASML', companyName: 'ASML Holding', thesis: 'Sole global monopoly manufacturer of Extreme Ultraviolet (EUV) photolithography scanners.', subCategory: 'Capital Equipment', marketCapCategory: 'Mega Cap' },
      { symbol: 'AVGO', companyName: 'Broadcom Inc', thesis: 'Market leader in custom AI ASICs (XPU) and high-throughput PCIe/Ethernet switching fabrics.', subCategory: 'Custom Silicon & Networking', marketCapCategory: 'Mega Cap' },
      { symbol: 'AMD', companyName: 'Advanced Micro Devices', thesis: 'Primary challenger to Nvidia with ROCm software maturity and Instinct MI300 series.', subCategory: 'Fabless CPU/GPU', marketCapCategory: 'Large Cap' },
      { symbol: 'QCOM', companyName: 'Qualcomm Inc', thesis: 'Leader in on-device generative AI NPU silicon and automotive digital cockpits.', subCategory: 'Edge Silicon & Mobile', marketCapCategory: 'Large Cap' },
      { symbol: 'AMAT', companyName: 'Applied Materials', thesis: 'Widest portfolio of deposition and etch semiconductor fabrication equipment.', subCategory: 'Wafer Fab Equipment', marketCapCategory: 'Large Cap' },
      { symbol: 'LRCX', companyName: 'Lam Research Corp', thesis: 'Indispensable leader in high-aspect-ratio cryogenic etch for 3D NAND and advanced packaging.', subCategory: 'Etch & Deposition', marketCapCategory: 'Large Cap' },
      { symbol: 'MU', companyName: 'Micron Technology', thesis: 'Leading memory supplier of High Bandwidth Memory (HBM3e) coupled to AI clusters.', subCategory: 'High Bandwidth Memory', marketCapCategory: 'Large Cap' },
    ],
  },
  ai: {
    refinedName: 'Artificial Intelligence & Neural Compute',
    description: 'Companies providing high-performance accelerators, foundational model platforms, and enterprise AI software infrastructure.',
    drivers: ['Enterprise LLM adoption & copilot deployment', 'Trillion-dollar data center capital expenditure', 'Token generation monetization'],
    stocks: [
      { symbol: 'NVDA', companyName: 'NVIDIA Corp', thesis: 'Foundational hardware backbone of all major generative AI clusters worldwide.', subCategory: 'Hardware Compute', marketCapCategory: 'Mega Cap' },
      { symbol: 'MSFT', companyName: 'Microsoft Corp', thesis: 'Direct partnership with OpenAI and Azure enterprise AI Copilot monetization.', subCategory: 'Hyperscale Cloud & SaaS', marketCapCategory: 'Mega Cap' },
      { symbol: 'PLTR', companyName: 'Palantir Technologies', thesis: 'AIP platform experiencing explosive enterprise operational AI deployment growth.', subCategory: 'Enterprise AI Software', marketCapCategory: 'Large Cap' },
      { symbol: 'GOOGL', companyName: 'Alphabet Inc', thesis: 'Gemini multimodal models, custom TPU silicon, and search/cloud generative integration.', subCategory: 'Model & Cloud Platform', marketCapCategory: 'Mega Cap' },
      { symbol: 'ARM', companyName: 'Arm Holdings plc', thesis: 'Pervasive low-power compute architecture licensing powering next-gen Neoverse AI server chips.', subCategory: 'Architecture IP', marketCapCategory: 'Large Cap' },
      { symbol: 'ANET', companyName: 'Arista Networks', thesis: 'Dominant 800G/1.6T Ethernet switching provider connecting thousands of AI GPU nodes.', subCategory: 'AI Interconnects', marketCapCategory: 'Large Cap' },
      { symbol: 'ALAB', companyName: 'Astera Labs', thesis: 'Critical PCIe connectivity retimers and memory connectivity modules for AI accelerators.', subCategory: 'High-Speed Connectivity', marketCapCategory: 'Mid Cap' },
      { symbol: 'SMCI', companyName: 'Super Micro Computer', thesis: 'Turnkey liquid-cooled server building block solutions with ultra-fast time to market.', subCategory: 'Liquid-Cooled Systems', marketCapCategory: 'Large Cap' },
    ],
  },
  nuclear: {
    refinedName: 'Nuclear Energy, SMRs & Clean Baseload',
    description: 'Nuclear power operators, uranium fuel cycle extractors, and Small Modular Reactor developers powering 24/7 AI data centers.',
    drivers: ['Tech hyperscalers contracting zero-carbon nuclear baseload power', 'Uranium structural supply deficit', 'SMR regulatory licensing momentum'],
    stocks: [
      { symbol: 'CCJ', companyName: 'Cameco Corp', thesis: 'Premier Western uranium mining producer with long-term contracting power and Westinghouse stake.', subCategory: 'Uranium Mining & Fuel', marketCapCategory: 'Large Cap' },
      { symbol: 'CEG', companyName: 'Constellation Energy', thesis: 'Largest US nuclear fleet operator with landmark data center off-take contracts.', subCategory: 'Nuclear Utility Operator', marketCapCategory: 'Large Cap' },
      { symbol: 'VST', companyName: 'Vistra Corp', thesis: 'Massive merchant power producer with substantial nuclear, gas, and battery generation assets.', subCategory: 'Independent Power Producer', marketCapCategory: 'Large Cap' },
      { symbol: 'SMR', companyName: 'NuScale Power', thesis: 'Only SMR design currently possessing US NRC standard design certification.', subCategory: 'Small Modular Reactors', marketCapCategory: 'Mid Cap' },
      { symbol: 'OKLO', companyName: 'Oklo Inc', thesis: 'Fast-fission clean power micro-reactors with backing from leading Silicon Valley executives.', subCategory: 'Advanced Nuclear Microreactors', marketCapCategory: 'Mid Cap' },
      { symbol: 'TLN', companyName: 'Talen Energy', thesis: 'Susquehanna nuclear power facility directly co-located with high-density data center campus.', subCategory: 'Nuclear Co-location', marketCapCategory: 'Large Cap' },
      { symbol: 'UEC', companyName: 'Uranium Energy Corp', thesis: 'Largest unhedged in-situ recovery (ISR) uranium producer in North America.', subCategory: 'ISR Uranium Producer', marketCapCategory: 'Mid Cap' },
      { symbol: 'BWX', companyName: 'BWX Technologies', thesis: 'Sole manufacturer of nuclear reactors and fuel for US naval submarine fleet expanding into commercial SMRs.', subCategory: 'Nuclear Engineering & Defense', marketCapCategory: 'Large Cap' },
    ],
  },
  cybersecurity: {
    refinedName: 'Cybersecurity & Zero-Trust Architecture',
    description: 'Enterprise security leaders combating nation-state threat actors, ransomware, and cloud infrastructure intrusions with AI defense.',
    drivers: ['Zero-trust network architecture compliance mandates', 'Autonomous AI-powered adversarial attacks', 'Vendor consolidation around single platforms'],
    stocks: [
      { symbol: 'CRWD', companyName: 'CrowdStrike Holdings', thesis: 'Falcon unified cloud platform leading endpoint detection, response, and identity protection.', subCategory: 'Endpoint & Cloud Security', marketCapCategory: 'Large Cap' },
      { symbol: 'PANW', companyName: 'Palo Alto Networks', thesis: 'Strata, Prisma, and Cortex platformization strategy capturing enterprise vendor consolidation.', subCategory: 'Network & Cloud Security', marketCapCategory: 'Large Cap' },
      { symbol: 'FTNT', companyName: 'Fortinet Inc', thesis: 'Custom ASIC-driven Secure Access Service Edge (SASE) and next-generation firewall market leader.', subCategory: 'SASE & Firewalls', marketCapCategory: 'Large Cap' },
      { symbol: 'ZS', companyName: 'Zscaler Inc', thesis: 'Cloud-native zero-trust exchange inspecting petabytes of enterprise traffic daily.', subCategory: 'Zero-Trust Exchange', marketCapCategory: 'Large Cap' },
      { symbol: 'NET', companyName: 'Cloudflare Inc', thesis: 'Massive global edge network protecting internet traffic with DDoS mitigation and Workers AI.', subCategory: 'Edge Security & CDN', marketCapCategory: 'Large Cap' },
      { symbol: 'CYBR', companyName: 'CyberArk Software', thesis: 'Dominant identity security provider specializing in privileged access management (PAM).', subCategory: 'Identity & Access Management', marketCapCategory: 'Large Cap' },
      { symbol: 'SENT', companyName: 'SentinelOne', thesis: 'Autonomous Singularity platform offering autonomous threat hunting and AI endpoint security.', subCategory: 'Autonomous Threat Defense', marketCapCategory: 'Mid Cap' },
    ],
  },
  defense: {
    refinedName: 'Aerospace, Defense & Autonomous Warfare',
    description: 'Defense prime contractors, munitions replenishment suppliers, and autonomous defense technology innovators.',
    drivers: ['Global NATO defense budget increases to 2-3% of GDP', 'Depleted munitions stockpiles requiring multi-year replenishment', 'Autonomous drone warfare & counter-UAS systems'],
    stocks: [
      { symbol: 'LMT', companyName: 'Lockheed Martin', thesis: 'F-35 stealth fighter program, PAC-3 missiles, and HIMARS rocket systems backbones of Western defense.', subCategory: 'Prime Defense Contractor', marketCapCategory: 'Large Cap' },
      { symbol: 'RTX', companyName: 'RTX Corp', thesis: 'Pratt & Whitney jet engines and Raytheon Patriot missile defense systems with record multi-year backlogs.', subCategory: 'Missiles & Aerospace', marketCapCategory: 'Large Cap' },
      { symbol: 'NOC', companyName: 'Northrop Grumman', thesis: 'B-21 Raider next-generation stealth bomber and Sentinel ICBM deterrence modernization program.', subCategory: 'Stealth Aviation & Space', marketCapCategory: 'Large Cap' },
      { symbol: 'GD', companyName: 'General Dynamics', thesis: 'Virginia & Columbia-class nuclear submarines and Abrams combat vehicles manufacturer.', subCategory: 'Marine & Combat Systems', marketCapCategory: 'Large Cap' },
      { symbol: 'PLTR', companyName: 'Palantir Technologies', thesis: 'TITAN battlefield AI program and Gotham defense intelligence targeting infrastructure.', subCategory: 'Defense AI & Intelligence', marketCapCategory: 'Large Cap' },
      { symbol: 'AXON', companyName: 'Axon Enterprise', thesis: 'TASER devices, law enforcement body cameras, and digital evidence management software monopoly.', subCategory: 'Public Safety & Body Cams', marketCapCategory: 'Large Cap' },
      { symbol: 'KTOS', companyName: 'Kratos Defense', thesis: 'Affordable unmanned combat drones (Valkyrie) and satellite communications defense technology.', subCategory: 'Unmanned Drone Systems', marketCapCategory: 'Mid Cap' },
    ],
  },
  clean_energy: {
    refinedName: 'Clean Energy, Solar & Grid Modernization',
    description: 'Utility-scale solar manufacturers, smart inverters, energy storage systems, and electrical transmission equipment leaders.',
    drivers: ['IRA domestic manufacturing tax credits', 'Data center and industrial electrification grid load', 'Energy storage battery cost declines'],
    stocks: [
      { symbol: 'FSLR', companyName: 'First Solar', thesis: 'US thin-film utility solar module manufacturer with multi-year sold-out domestic production.', subCategory: 'Utility Solar Modules', marketCapCategory: 'Large Cap' },
      { symbol: 'NEE', companyName: 'NextEra Energy', thesis: 'World largest producer of wind and solar renewable energy backed by regulated Florida utility.', subCategory: 'Renewable Utility', marketCapCategory: 'Large Cap' },
      { symbol: 'ENPH', companyName: 'Enphase Energy', thesis: 'Microinverter technology and residential solar energy management systems.', subCategory: 'Microinverters & Storage', marketCapCategory: 'Large Cap' },
      { symbol: 'GEV', companyName: 'GE Vernova', thesis: 'Pure-play electrification, gas turbines, grid solutions, and wind energy equipment power player.', subCategory: 'Grid Equipment & Turbines', marketCapCategory: 'Large Cap' },
      { symbol: 'BE', companyName: 'Bloom Energy', thesis: 'Solid oxide fuel cell on-site power generation delivering rapid power for AI data centers.', subCategory: 'On-Site Fuel Cells', marketCapCategory: 'Mid Cap' },
      { symbol: 'HASI', companyName: 'Hannon Armstrong', thesis: 'Climate solutions investment firm financing energy efficiency, storage, and clean power.', subCategory: 'Clean Energy Infrastructure', marketCapCategory: 'Mid Cap' },
    ],
  },
  dividends: {
    refinedName: 'Dividend Aristocrats & Cash Compounders',
    description: 'Blue-chip companies with decades of consecutive dividend increases, fortress balance sheets, and recession-resilient cash flows.',
    drivers: ['High quality factor outperformance in volatile rate environments', 'Shareholder return compounding through dividend reinvestment', 'Pricing power protecting operating margins'],
    stocks: [
      { symbol: 'JNJ', companyName: 'Johnson & Johnson', thesis: 'AAA-rated healthcare colossus with over 60 consecutive years of dividend increases.', subCategory: 'Healthcare Pharmaceuticals', marketCapCategory: 'Mega Cap' },
      { symbol: 'PG', companyName: 'Procter & Gamble', thesis: 'Dominant global consumer staple brands with supreme pricing power and 68 years of dividend hikes.', subCategory: 'Consumer Staples', marketCapCategory: 'Mega Cap' },
      { symbol: 'ABBV', companyName: 'AbbVie Inc', thesis: 'High-yield biopharma leader successfully replacing Humira revenue with Skyrizi and Rinvoq.', subCategory: 'Biopharmaceuticals', marketCapCategory: 'Large Cap' },
      { symbol: 'KO', companyName: 'The Coca-Cola Co', thesis: 'Global beverage distribution titan generating massive recurring free cash flow dividends.', subCategory: 'Consumer Staples', marketCapCategory: 'Large Cap' },
      { symbol: 'CVX', companyName: 'Chevron Corp', thesis: 'Low-cost Permian Basin energy producer returning tens of billions via dividends and buybacks.', subCategory: 'Integrated Energy', marketCapCategory: 'Large Cap' },
      { symbol: 'O', companyName: 'Realty Income Corp', thesis: 'The Monthly Dividend Company owning triple-net leased mission-critical commercial real estate.', subCategory: 'Triple-Net REIT', marketCapCategory: 'Large Cap' },
      { symbol: 'MAIN', companyName: 'Main Street Capital', thesis: 'Premier BDC generating consistent monthly regular and supplemental high-yield dividends.', subCategory: 'Business Development Co', marketCapCategory: 'Mid Cap' },
    ],
  },
  commodities: {
    refinedName: 'Critical Commodities & Strategic Metals',
    description: 'Low-cost producers of copper, gold, fertilizers, and base industrial metals vital for the physical economy.',
    drivers: ['Decade of mining underinvestment creating structural supply deficit', 'Electrification supercycle consuming unprecedented copper', 'Central bank gold reserve accumulation'],
    stocks: [
      { symbol: 'FCX', companyName: 'Freeport-McMoRan', thesis: 'Tier-1 copper assets (Grasberg, Morenci) directly levered to global electrical grid and EV buildouts.', subCategory: 'Copper Mining', marketCapCategory: 'Large Cap' },
      { symbol: 'NEM', companyName: 'Newmont Corp', thesis: 'Largest gold mining producer globally benefiting directly from central bank gold reserve buying.', subCategory: 'Gold Mining', marketCapCategory: 'Large Cap' },
      { symbol: 'SCCO', companyName: 'Southern Copper Corp', thesis: 'Lowest cash-cost copper producer in the Americas with massive multi-decade reserves.', subCategory: 'Low-Cost Copper', marketCapCategory: 'Large Cap' },
      { symbol: 'VALE', companyName: 'Vale S.A.', thesis: 'High-grade iron ore and base metals producer trading at generous cash flow yields.', subCategory: 'Iron Ore & Nickel', marketCapCategory: 'Large Cap' },
      { symbol: 'RIO', companyName: 'Rio Tinto plc', thesis: 'Diversified mining conglomerate with world-class Pilbara iron ore and Oyu Tolgoi copper.', subCategory: 'Diversified Mining', marketCapCategory: 'Large Cap' },
      { symbol: 'CLF', companyName: 'Cleveland-Cliffs', thesis: 'Largest flat-rolled steel and direct reduced iron producer in North America.', subCategory: 'Steel & Metallurgical', marketCapCategory: 'Mid Cap' },
    ],
  },
  biotech: {
    refinedName: 'Biotechnology, GLP-1 & Precision Oncology',
    description: 'Metabolic disease leaders, gene editing innovators, and precision oncology biopharma companies.',
    drivers: ['GLP-1 obesity and cardiometabolic TAM exceeding $100B by 2030', 'ADC (antibody-drug conjugate) cancer therapeutics', 'AI-driven de novo drug discovery acceleration'],
    stocks: [
      { symbol: 'LLY', companyName: 'Eli Lilly and Co', thesis: 'Unrivaled leader in GLP-1/GIP incretin therapies (Mounjaro, Zepbound) with pipeline depth.', subCategory: 'Metabolic & Obesity', marketCapCategory: 'Mega Cap' },
      { symbol: 'NVO', companyName: 'Novo Nordisk A/S', thesis: 'Pioneering developer of semaglutide (Ozempic, Wegovy) scaling massive global supply.', subCategory: 'Diabetes & Obesity', marketCapCategory: 'Mega Cap' },
      { symbol: 'VRTX', companyName: 'Vertex Pharmaceuticals', thesis: 'Cystic fibrosis cash generator commercializing Casgevy gene editing and non-opioid pain therapies.', subCategory: 'Monopoly Rare Disease', marketCapCategory: 'Large Cap' },
      { symbol: 'REGN', companyName: 'Regeneron Pharmaceuticals', thesis: 'Proprietary antibody technology platform commercializing Dupixent and Libtayo.', subCategory: 'Antibody Platforms', marketCapCategory: 'Large Cap' },
      { symbol: 'ISRG', companyName: 'Intuitive Surgical', thesis: 'Dominant da Vinci robotic surgical systems with high recurring razor-and-blade instrument revenue.', subCategory: 'Robotic Surgery', marketCapCategory: 'Large Cap' },
      { symbol: 'AMGN', companyName: 'Amgen Inc', thesis: 'Diversified biopharma with MariTide obesity therapy showing prolonged dosing intervals.', subCategory: 'Targeted Therapeutics', marketCapCategory: 'Large Cap' },
    ],
  },
  fintech: {
    refinedName: 'FinTech, Digital Payments & Crypto Infrastructure',
    description: 'Transaction networks, neo-brokerages, digital asset custodians, and financial software platforms.',
    drivers: ['Global cashless transition and real-time payment rails', 'Retail investor participation and options volume growth', 'Institutional crypto ETF adoption and stablecoin settlements'],
    stocks: [
      { symbol: 'V', companyName: 'Visa Inc', thesis: 'Global payment network duopoly collecting a recurring toll on trillions in consumer commerce.', subCategory: 'Payment Rails', marketCapCategory: 'Mega Cap' },
      { symbol: 'MA', companyName: 'Mastercard Inc', thesis: 'Global payment network with high operating margins and double-digit cross-border volume growth.', subCategory: 'Payment Rails', marketCapCategory: 'Mega Cap' },
      { symbol: 'COIN', companyName: 'Coinbase Global', thesis: 'Primary custodian for major spot Bitcoin & Ethereum ETFs and leading US crypto exchange.', subCategory: 'Crypto Custody & Exchange', marketCapCategory: 'Large Cap' },
      { symbol: 'HOOD', companyName: 'Robinhood Markets', thesis: 'Rapidly expanding modern broker capturing retail options, margin, and crypto trading share.', subCategory: 'Retail Trading Platform', marketCapCategory: 'Large Cap' },
      { symbol: 'SQ', companyName: 'Block Inc', thesis: 'Cash App ecosystem monetizing peer-to-peer banking and Square seller POS software.', subCategory: 'Digital Wallet & POS', marketCapCategory: 'Large Cap' },
      { symbol: 'SOFI', companyName: 'SoFi Technologies', thesis: 'Fast-growing digital bank with Galileo financial technology infrastructure.', subCategory: 'Digital Banking', marketCapCategory: 'Mid Cap' },
    ],
  },
  robotics: {
    refinedName: 'Robotics, Autonomous Systems & Industrial Tech',
    description: 'Industrial automation equipment, machine vision, autonomous vehicles, and warehouse robotics.',
    drivers: ['Labor shortages driving warehouse and factory automation ROI', 'Vision neural networks enabling autonomous navigation', 'Reshoring and domestic factory construction'],
    stocks: [
      { symbol: 'TSLA', companyName: 'Tesla Inc', thesis: 'Full Self-Driving neural network fleet and Optimus general-purpose humanoid robotics development.', subCategory: 'Autonomous Mobility & AI', marketCapCategory: 'Mega Cap' },
      { symbol: 'ISRG', companyName: 'Intuitive Surgical', thesis: 'Global monopoly standard in minimally invasive robotic surgery systems and instruments.', subCategory: 'Medical Robotics', marketCapCategory: 'Large Cap' },
      { symbol: 'ROK', companyName: 'Rockwell Automation', thesis: 'Leading pure-play provider of industrial automation hardware, PLCs, and control software.', subCategory: 'Factory Automation', marketCapCategory: 'Large Cap' },
      { symbol: 'CGNX', companyName: 'Cognex Corp', thesis: 'Machine vision sensors and barcode readers inspecting factory manufacturing lines.', subCategory: 'Machine Vision Sensors', marketCapCategory: 'Mid Cap' },
      { symbol: 'PATH', companyName: 'UiPath Inc', thesis: 'Enterprise robotic process automation (RPA) and AI agent workforce automation software.', subCategory: 'Software Automation', marketCapCategory: 'Mid Cap' },
      { symbol: 'SYM', companyName: 'Symbotic Inc', thesis: 'AI-powered autonomous mobile robots automating supply chain distribution warehouses for Walmart.', subCategory: 'Warehouse Mobile Robotics', marketCapCategory: 'Mid Cap' },
    ],
  },
};

/**
 * Match a raw user topic against the knowledge base
 */
function findThematicPreset(topic: string): ThematicPreset | null {
  const clean = topic.toLowerCase().trim();
  for (const [key, preset] of Object.entries(THEMATIC_KNOWLEDGE_BASE)) {
    if (clean.includes(key)) return preset;
  }
  // Secondary synonym matching
  if (clean.includes('chip') || clean.includes('silicon') || clean.includes('hardware')) return THEMATIC_KNOWLEDGE_BASE.semiconductor;
  if (clean.includes('gpt') || clean.includes('model') || clean.includes('llm') || clean.includes('intelligence')) return THEMATIC_KNOWLEDGE_BASE.ai;
  if (clean.includes('uranium') || clean.includes('smr') || clean.includes('reactor') || clean.includes('atomic')) return THEMATIC_KNOWLEDGE_BASE.nuclear;
  if (clean.includes('security') || clean.includes('hack') || clean.includes('firewall')) return THEMATIC_KNOWLEDGE_BASE.cybersecurity;
  if (clean.includes('military') || clean.includes('war') || clean.includes('weapon') || clean.includes('aerospace')) return THEMATIC_KNOWLEDGE_BASE.defense;
  if (clean.includes('solar') || clean.includes('wind') || clean.includes('green') || clean.includes('renewable')) return THEMATIC_KNOWLEDGE_BASE.clean_energy;
  if (clean.includes('yield') || clean.includes('income') || clean.includes('aristocrat')) return THEMATIC_KNOWLEDGE_BASE.dividends;
  if (clean.includes('metal') || clean.includes('gold') || clean.includes('copper') || clean.includes('miner')) return THEMATIC_KNOWLEDGE_BASE.commodities;
  if (clean.includes('pharma') || clean.includes('drug') || clean.includes('cancer') || clean.includes('health') || clean.includes('glp')) return THEMATIC_KNOWLEDGE_BASE.biotech;
  if (clean.includes('bank') || clean.includes('payment') || clean.includes('crypto') || clean.includes('broker')) return THEMATIC_KNOWLEDGE_BASE.fintech;
  if (clean.includes('auto') || clean.includes('vision') || clean.includes('drone')) return THEMATIC_KNOWLEDGE_BASE.robotics;

  return null;
}

/**
 * Primary Agent function: Researches stocks related to any watchlist topic
 */
export async function researchThematicStocks(options: ResearchThematicOptions): Promise<ThematicLookupResult> {
  const { topic, existingSymbols = [], customFocus, count = 8 } = options;
  const cleanTopic = (topic || '').trim();

  if (!cleanTopic) {
    throw new Error('Watchlist topic or name cannot be empty.');
  }

  const existingSet = new Set(existingSymbols.map((s) => s.trim().toUpperCase()));
  logToFile(`[ThematicWatchlistAgent] Researching stocks for topic: "${cleanTopic}" (existing: ${existingSet.size})`);

  let refinedTopicName = cleanTopic;
  let themeDescription = `Thematic basket curated for "${cleanTopic}" focusing on liquid US-listed market leaders and pure-play beneficiaries.`;
  let keyDrivers: string[] = ['Secular growth inflection', 'Institutional capital allocation', 'High-moat market positioning'];
  let rawCandidates: Array<{
    symbol: string;
    companyName: string;
    thesis: string;
    subCategory?: string;
    marketCapCategory?: string;
  }> = [];
  let source: 'ai_agent' | 'thematic_heuristic' = 'ai_agent';

  // 1. First attempt: Query LLM agent via fallback router
  try {
    const systemPrompt = `You are an elite Wall Street Quantitative Thematic Research Director and Hedge Fund Sector Specialist.
The user wants to construct or expand a focused thematic equity watchlist for the investment theme: "${cleanTopic}".

STRICT GUIDELINES:
1. Identify between ${Math.min(count, 10)} and 10 premier, high-quality, liquid US-listed stocks (NYSE or NASDAQ) or leading liquid US ADRs.
2. Ticker symbols MUST be valid standard US symbols (e.g. NVDA, MSFT, TSM, ASML, PLTR, CRWD, CCJ, LMT, CEG). Never output made-up, obsolete, or crypto symbols.
3. For each stock provide:
   - "symbol": exact uppercase ticker.
   - "companyName": official corporate name.
   - "thesis": A sharp, concise 1-2 sentence investment rationale detailing why this stock is a core winner, key beneficiary, or market leader in this specific theme.
   - "subCategory": The stock's strategic role (e.g. "Pure-Play Hardware", "SaaS Infrastructure", "Foundry Leader", "Equipment Supplier", "Defense Prime", "Fuel Cycle / Miner", etc.).
   - "marketCapCategory": "Mega Cap", "Large Cap", or "Mid Cap".
4. If "existingSymbols" are provided, prioritize complementary candidates that are NOT in the existing symbols list to avoid redundancy.
5. If "customFocus" is specified, align your picks with that instruction (e.g. "dividend payers", "small-to-mid cap", "pure plays only").

Output strictly valid JSON matching this schema:
{
  "topic": "${cleanTopic}",
  "refinedTopicName": "Concise Professional Theme Title",
  "themeDescription": "2-3 sentences explaining the structural macroeconomic dynamics, catalysts, and secular growth drivers for this theme right now",
  "keyDrivers": ["Secular Driver 1", "Secular Driver 2", "Secular Driver 3"],
  "stocks": [
    {
      "symbol": "TICKER",
      "companyName": "Company Name",
      "thesis": "Concise 1-2 sentence investment rationale.",
      "subCategory": "Role / Sub-sector",
      "marketCapCategory": "Large Cap"
    }
  ]
}`;

    const userPrompt = `Watchlist Topic: "${cleanTopic}"
Existing symbols already in watchlist: [${existingSymbols.join(', ')}]
${customFocus ? `User Custom Focus / Constraints: "${customFocus}"` : ''}
Target number of stocks: ${count}
Please research and recommend the top thematic candidates.`;

    const completion = await generateJsonCompletion<{
      topic?: string;
      refinedTopicName?: string;
      themeDescription?: string;
      keyDrivers?: string[];
      stocks?: Array<{
        symbol: string;
        companyName: string;
        thesis: string;
        subCategory?: string;
        marketCapCategory?: string;
      }>;
    }>({
      systemPrompt,
      userPrompt,
      temperature: 0.25,
      tag: '[ThematicWatchlistAgent] ',
    });

    if (completion.data?.stocks && Array.isArray(completion.data.stocks) && completion.data.stocks.length > 0) {
      refinedTopicName = completion.data.refinedTopicName || cleanTopic;
      themeDescription = completion.data.themeDescription || themeDescription;
      keyDrivers = completion.data.keyDrivers || keyDrivers;
      rawCandidates = completion.data.stocks;
      source = 'ai_agent';
      logToFile(`[ThematicWatchlistAgent] LLM returned ${rawCandidates.length} candidates for "${cleanTopic}"`);
    } else {
      throw new Error('LLM returned empty stock candidate list.');
    }
  } catch (llmErr: any) {
    logToFile(`[ThematicWatchlistAgent] LLM query fallback notice: ${llmErr?.message}. Checking heuristic catalog...`);

    // 2. Fallback to knowledge base preset
    const preset = findThematicPreset(cleanTopic);
    if (preset) {
      refinedTopicName = preset.refinedName;
      themeDescription = preset.description;
      keyDrivers = preset.drivers;
      rawCandidates = preset.stocks;
      source = 'thematic_heuristic';
      logToFile(`[ThematicWatchlistAgent] Using curated preset "${preset.refinedName}" (${rawCandidates.length} stocks)`);
    } else {
      // Generic fallback for uncommon names
      refinedTopicName = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
      themeDescription = `Autonomous research basket targeting institutional opportunities in ${cleanTopic}.`;
      keyDrivers = ['Secular tailwinds', 'High return on invested capital', 'Operating leverage'];
      // Sample standard institutional leaders
      rawCandidates = [
        { symbol: 'MSFT', companyName: 'Microsoft Corporation', thesis: `Enterprise software and cloud giant providing baseline exposure relevant to ${cleanTopic}.`, subCategory: 'Enterprise Tech', marketCapCategory: 'Mega Cap' },
        { symbol: 'NVDA', companyName: 'NVIDIA Corporation', thesis: `Hardware computing standard powering modern infrastructure for ${cleanTopic}.`, subCategory: 'Compute Infrastructure', marketCapCategory: 'Mega Cap' },
        { symbol: 'AAPL', companyName: 'Apple Inc.', thesis: `Consumer ecosystem and cash generation compounding machine.`, subCategory: 'Consumer Tech', marketCapCategory: 'Mega Cap' },
        { symbol: 'AMZN', companyName: 'Amazon.com Inc.', thesis: `Global cloud infrastructure and logistics network leader.`, subCategory: 'Cloud & Commerce', marketCapCategory: 'Mega Cap' },
        { symbol: 'GOOGL', companyName: 'Alphabet Inc.', thesis: `Multimodal AI platform, digital advertising, and cloud compute.`, subCategory: 'Search & Cloud', marketCapCategory: 'Mega Cap' },
      ];
      source = 'thematic_heuristic';
    }
  }

  // 3. Sanitize symbols & deduplicate
  const seenSymbols = new Set<string>();
  const sanitizedCandidates: typeof rawCandidates = [];

  for (const c of rawCandidates) {
    if (!c.symbol || typeof c.symbol !== 'string') continue;
    const cleanSym = c.symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
    if (cleanSym.length >= 1 && cleanSym.length <= 8 && !seenSymbols.has(cleanSym)) {
      seenSymbols.add(cleanSym);
      sanitizedCandidates.push({
        ...c,
        symbol: cleanSym,
      });
    }
  }

  // 4. Enrich candidates with live market quote data via Yahoo Finance in parallel
  logToFile(`[ThematicWatchlistAgent] Enriching ${sanitizedCandidates.length} candidates with live market telemetry...`);

  const enrichedStocks: ThematicStockCandidate[] = await Promise.all(
    sanitizedCandidates.map(async (candidate) => {
      const sym = candidate.symbol;
      const querySym = resolveYahooFinanceSymbol(sym) || sym;
      let price: number | undefined;
      let changePercent: number | undefined;
      let marketCap: number | undefined;
      let pe: number | undefined;
      let sector: string | undefined;
      let industry: string | undefined;
      let companyName = candidate.companyName;

      try {
        const quote: any = await yahooFinance.quote(querySym, {}, { validateResult: false }).catch(() => null);
        if (quote) {
          if (quote.regularMarketPrice !== undefined) {
            price = quote.regularMarketPrice;
          }
          if (quote.regularMarketChangePercent !== undefined) {
            changePercent = quote.regularMarketChangePercent;
          }
          if (quote.marketCap !== undefined) {
            marketCap = quote.marketCap;
          }
          if (quote.trailingPE !== undefined || quote.forwardPE !== undefined) {
            pe = quote.trailingPE || quote.forwardPE;
          }
          sector = quote.sector;
          industry = quote.industry;
          companyName = quote.shortName || quote.longName || companyName;
        }
      } catch (err) {
        // Quote fetch failed silently, fallback to candidate basics
      }

      return {
        symbol: sym,
        companyName,
        thesis: candidate.thesis,
        subCategory: candidate.subCategory || 'Pure Play',
        marketCapCategory: candidate.marketCapCategory || 'Large Cap',
        price,
        changePercent,
        marketCap,
        pe,
        sector,
        industry,
        isAlreadyInWatchlist: existingSet.has(sym),
      };
    })
  );

  return {
    topic: cleanTopic,
    refinedTopicName,
    themeDescription,
    keyDrivers,
    stocks: enrichedStocks,
    source,
  };
}
