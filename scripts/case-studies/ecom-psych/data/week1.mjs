// Week 1: Behavioral Economics Core / 行为经济学核心
// Source: https://www.feishu.cn/docx/VbJodQoomoELQhx9oE9lovbigxf
// D1-D7: real content from Feishu doc.

export const week1 = {
  week: 1,
  titleEn: "Behavioral Economics Core",
  titleZh: "行为经济学核心",
  feishuUrl: "https://www.feishu.cn/docx/VbJodQoomoELQhx9oE9lovbigxf",
  days: [
    // ===== D1: Anchoring Effect / 锚定效应 =====
    {
      day: 1,
      objectiveEn: "Identify primary, auxiliary, and external anchors on an e-commerce page and judge anchor credibility.",
      objectiveZh: "识别电商页面的主锚点、辅助锚点和外部锚点，并判断锚点是否可信。",
      oneLiner: "锚定不是写高原价，而是建立可信参照。 / Anchoring is not about inflating prices; it is about building a credible reference point.",
      keyTerms: [
        {
          key: "anchoring",
          termEn: "Anchoring Effect",
          termZh: "锚定效应",
          definition: "The first salient reference point biases subsequent value judgments. / 第一个显著参照点影响后续价值判断。",
          example: "A high-end bundle shown first makes the recommended bundle feel more reasonable.",
          tags: ["anchoring", "pricing"],
        },
        {
          key: "ref-price",
          termEn: "Reference Price",
          termZh: "参考价格",
          definition: "The price a shopper uses to compare the current offer. / 用户用来比较当前价格的参照价格。",
          example: "'Last 30-day lowest price' is stronger than a vague crossed-out price.",
          tags: ["anchoring", "pricing"],
        },
        {
          key: "ext-anchor",
          termEn: "External Anchor",
          termZh: "外部锚点",
          definition: "A reference the shopper brings from outside the page (competitors, history). / 用户从站外、竞品或历史经验带来的锚点。",
          example: "Shoppers who checked JD or Amazon may ignore an inflated in-page anchor.",
          tags: ["anchoring", "trust"],
        },
        {
          key: "price-cred",
          termEn: "Price Credibility",
          termZh: "价格可信度",
          definition: "Whether the shopper believes the reference price is real. / 用户是否相信价格参照真实。",
          example: "A verified historical price improves credibility; a fake list price destroys it.",
          tags: ["anchoring", "trust"],
        },
      ],
      concepts: [
        {
          key: "anchor_core",
          termEn: "Anchoring Effect",
          termZh: "锚定效应",
          keyQuote: "锚定不是写高原价，而是建立可信参照。Anchoring is not inventing a bigger price; it is giving the shopper a reference point they can believe.",
          explanation: "Anchoring means the first or most salient reference point biases subsequent value judgments. In e-commerce, anchors come from crossed-out prices, premium bundles, historical prices, competitor prices, member prices, platform subsidies, and livestream narratives. Strong-comparison categories (standard goods) are dangerous: shoppers who researched externally will ignore or distrust inflated in-page anchors.",
          reviewPrompt: "What is the anchoring effect in e-commerce, and what makes an anchor credible vs. dangerous?",
          reviewAnswer: "Anchoring is when the first salient reference biases value judgments. Credible anchors have verifiable sources (real premium bundles, verified historical prices); dangerous anchors are inflated crossed-out prices with no evidence, which destroy trust especially in strong-comparison categories.",
          tags: ["anchoring", "core-concept"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "True or false: Writing a higher crossed-out price will reliably increase conversion via anchoring.",
          answer: "False. Anchors must be credible; inflated list prices damage trust and may backfire, especially for strong-comparison goods.",
        },
        {
          key: "st2",
          question: "When are in-page price anchors likely to be weakened by external anchors?",
          answer: "When shoppers have already researched prices on competitors (JD, Amazon) or have strong prior price knowledge for standard/comparison goods.",
        },
      ],
      practice: {
        prompt: "Choose 3 product or campaign pages. Screenshot the above-the-fold price area. Mark: in-page anchor / likely external anchor / target SKU / risky anchor. For each, write one judgment: credible, weakly credible, or dangerous.",
        exampleOutput: "Page A: first shows ¥999 premium bundle, then ¥699 recommended; anchor credibility=medium because premium feature difference is real. External anchor=competitor same-feature item at ¥649. Risk=if user comparison-shops, ¥999 won't anchor. Primary metrics=target SKU share, AOV; guardrails=price-complaint exit rate, refund rate.",
      },
      ttsSegments: [
        {
          enScript: "Anchoring is not about inventing a bigger price. It is about giving the shopper a reference point they can believe. Today, look at the first price signal on a product page, the competing prices the user may already know, and the package you want them to choose.",
          zhRecap: "今天学锚定，但不是学虚高原价。你要判断用户第一眼看到什么参照、这个参照是否可信、会不会被站外比价削弱。",
          shadowingSentence: "If the anchor is credible, then we expect target-package share to improve, measured by package share and guarded by price complaints.",
        },
      ],
      openQuestions: [
        {
          text: "How does anchoring interact with loss aversion in flash-sale countdown timers?",
          tags: ["anchoring", "loss-aversion", "cross-concept"],
        },
      ],
      parkedQuestions: [
        {
          text: "Do anchoring effects differ cross-culturally between Chinese and Western e-commerce contexts?",
          tags: ["anchoring", "cross-cultural"],
        },
      ],
      experimentHint: {
        hypothesis: "A credible premium-bundle anchor (vs. vague crossed-out price) increases target SKU share.",
        notes: "Control=no clear anchor or old crossed-out price; Variant=real premium/historical/member-price anchor. Primary metrics=target SKU share, AOV, payment CVR; guardrails=price complaints, refund rate, comparison-page exit. Run at least 7 days; segment by new/returning and internal/external traffic.",
      },
      rubric: "0=only circles crossed-out prices, no credibility judgment; 1=identifies anchors and target metrics but misses external anchors/risks; 2=differentiates credible/weak/risky anchors with primary metrics and long-term guardrails.",
    },

    // ===== D2: Loss Aversion / 损失厌恶 =====
    {
      day: 2,
      objectiveEn: "Identify loss framing in e-commerce UI and distinguish it from gain framing.",
      objectiveZh: "识别电商界面中的损失框架，并与收益框架区分。",
      oneLiner: "失去的痛苦大约是获得快乐的两倍——「不失去」比「额外获得」更有驱动力。 / The pain of losing is roughly twice the pleasure of gaining; 'don't lose' drives action more than 'gain extra'.",
      keyTerms: [
        {
          key: "loss-aversion",
          termEn: "Loss Aversion",
          termZh: "损失厌恶",
          definition: "People feel losses more strongly than equivalent gains. / 人们对损失的感受比同等收益更强烈。",
          example: "'Save ¥20' outperforms 'Get ¥20 off' because it frames the price as a potential loss.",
          tags: ["loss-aversion", "framing"],
        },
        {
          key: "framing",
          termEn: "Framing Effect",
          termZh: "框架效应",
          definition: "The same outcome presented as a loss vs. a gain changes decisions. / 同一结果以损失或收益框架呈现会改变决策。",
          example: "'Only 3 left' (loss) vs. 'In stock' (neutral) changes urgency.",
          tags: ["loss-aversion", "framing"],
        },
        {
          key: "endowment",
          termEn: "Endowment Effect",
          termZh: "禀赋效应",
          definition: "People value what they already possess more than what they could gain. / 人们更珍视已拥有的东西。",
          example: "Free trials that auto-renew leverage the endowment effect — canceling feels like losing something owned.",
          tags: ["loss-aversion", "subscriptions"],
        },
      ],
      concepts: [
        {
          key: "loss_core",
          termEn: "Loss Aversion",
          termZh: "损失厌恶",
          keyQuote: "The pain of losing is roughly twice as strong as the pleasure of gaining the same amount.",
          explanation: "Loss aversion means people weigh potential losses about 2x more heavily than equivalent gains. In e-commerce, this shows up as: 'Don't miss out' vs. 'Get this deal', countdown timers creating potential loss of opportunity, stock scarcity messaging, and free-trial auto-renewal leveraging the endowment effect. Overuse leads to banner blindness and trust erosion.",
          reviewPrompt: "Why does 'Save ¥20' typically outperform 'Get ¥20 off' in e-commerce copy?",
          reviewAnswer: "'Save ¥20' frames the reference price as money the shopper already expects to spend, so not saving feels like a loss. 'Get ¥20 off' frames it as a gain, which is psychologically weaker due to loss aversion.",
          tags: ["loss-aversion", "core-concept"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "Which framing is typically more effective: 'You save ¥50' or 'You get ¥50 off'?",
          answer: "'You save ¥50' is more effective because it frames the ¥50 as a potential loss if not acted upon, leveraging loss aversion.",
        },
        {
          key: "st2",
          question: "What is the risk of overusing scarcity/loss messaging?",
          answer: "Overuse leads to banner blindness, erodes trust (fake scarcity), and can create urgency fatigue where shoppers tune out all loss-framed messages.",
        },
      ],
      practice: {
        prompt: "Find 3 examples of loss framing in current e-commerce (countdowns, stock warnings, expiring offers). For each, note whether the loss is real or manufactured, and whether you find it credible.",
        exampleOutput: "Flash sale countdown on Taobao: real-time stock ticker showing '2 left' — credible if stock numbers are truthful; 'Offer expires in 2h' that resets on refresh — manufactured, erodes trust over time.",
      },
      ttsSegments: [
        {
          enScript: "Loss aversion means the fear of missing out is stronger than the hope of gaining something extra. When you write copy, ask: am I describing what the shopper stands to lose, or what they might gain? The loss frame usually moves faster, but only if it is honest.",
          zhRecap: "损失厌恶说的是「怕失去」比「想得到」更有力。写文案时问自己：我在描述用户会失去什么，还是会得到什么？但损失框架必须真实。",
          shadowingSentence: "A genuine loss frame converts; a manufactured loss frame trains users not to trust you.",
        },
      ],
      resolvedQuestions: [
        {
          question: "Why does 'save ¥20' outperform 'get ¥20 off'?",
          answer: "'Save' implies the ¥20 is already the shopper's money they're about to spend — not acting means losing it. 'Get ¥20 off' frames it as a bonus gain. Loss aversion makes the loss frame ~2x more psychologically powerful.",
          answerThought: "Key insight: the reference point matters. 'Save' anchors to the higher price as the status quo; 'get off' anchors to the lower price as baseline.",
          tags: ["loss-aversion", "copywriting"],
        },
      ],
      experimentHint: {
        hypothesis: "Loss-framed CTA copy ('Don't lose your 20% discount') outperforms gain-framed copy ('Get 20% off') on cart abandonment recovery.",
        notes: "Test on abandoned-cart push/email. Primary metric=cart recovery CVR; guardrail=unsubscribe rate, complaint rate. Run 7+ days; watch for fatigue effects over time.",
      },
      rubric: "0=cannot identify loss framing; 1=can identify loss vs gain framing but cannot assess credibility; 2=can identify, assess credibility, and suggest A/B test with guardrails.",
    },

    // ===== D3: Default Effect & Choice Architecture / 默认选项与选择架构 =====
    {
      day: 3,
      objectiveEn: "Identify default options and choice architecture in e-commerce flows and assess their ethical boundaries.",
      objectiveZh: "识别电商流程中的默认选项和选择架构，并评估其伦理边界。",
      oneLiner: "默认选项是最强大的隐形说服——也最容易滑向 dark pattern。 / Defaults are the most powerful invisible persuasion — and the easiest to slide into dark patterns.",
      keyTerms: [
        {
          key: "default-effect",
          termEn: "Default Effect",
          termZh: "默认选项效应",
          definition: "People tend to stick with the pre-selected option. / 人们倾向于保持预先选择的选项。",
          example: "Opt-out subscription renewals have much higher retention than opt-in.",
          tags: ["defaults", "choice-architecture"],
        },
        {
          key: "choice-arch",
          termEn: "Choice Architecture",
          termZh: "选择架构",
          definition: "How options are presented (order, grouping, defaults) shapes decisions. / 选项呈现方式（顺序、分组、默认值）塑造决策。",
          example: "Putting the recommended plan in the middle with 'Most Popular' label steers choice without restricting it.",
          tags: ["defaults", "ethics"],
        },
        {
          key: "opt-in-opt-out",
          termEn: "Opt-in vs. Opt-out",
          termZh: "选择加入 vs. 选择退出",
          definition: "Opt-in requires active choice to participate; opt-out requires active choice to leave. / 选择加入需主动勾选；选择退出需主动取消。",
          example: "GDPR requires opt-in for marketing consent; many subscription services use opt-out auto-renewal.",
          tags: ["defaults", "ethics", "regulation"],
        },
      ],
      concepts: [
        {
          key: "default_core",
          termEn: "Default Effect and Choice Architecture",
          termZh: "默认选项效应与选择架构",
          keyQuote: "Defaults are the most powerful form of invisible persuasion — and the easiest to abuse.",
          explanation: "The default option is what happens when the user does nothing. Because effort, inertia, and implied endorsement all favor the default, it dramatically shapes outcomes. Choice architecture includes ordering (putting the recommended option first/middle), grouping (3-tired pricing), labeling ('Recommended', 'Most Popular'), and the choice of opt-in vs. opt-out. Ethical defaults align with what most users would choose if fully informed; dark patterns use defaults to trick users into options they would not choose (hidden auto-renewal, pre-checked upsells).",
          reviewPrompt: "What makes a default ethical vs. a dark pattern?",
          reviewAnswer: "An ethical default reflects what most informed users would choose, is transparent (clearly labeled), and easy to change. A dark pattern exploits inertia to push options users would reject if fully informed (hidden auto-renewal, pre-checked add-ons, confusing opt-out flows).",
          tags: ["defaults", "core-concept", "ethics"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "Why are opt-out subscriptions more profitable than opt-in?",
          answer: "Loss aversion (canceling feels like losing something) plus inertia (effort to cancel) plus the endowment effect (already 'owning' the service) make opt-out retention much higher.",
        },
        {
          key: "st2",
          question: "What distinguishes a helpful recommendation from a dark pattern in choice architecture?",
          answer: "Transparency (clearly labeled as recommendation), reversibility (easy to change), and alignment with user interests (not exploiting uninformed choice).",
        },
      ],
      practice: {
        prompt: "Audit one checkout or subscription flow. Mark all defaults (pre-selected options, pre-checked boxes, auto-renewal). For each, classify: helpful, neutral, or potentially unethical.",
        exampleOutput: "Food delivery app checkout: 'No utensils' pre-selected (helpful, aligns with environmental preference); auto-renewal VIP membership buried in terms (potentially unethical, not transparently disclosed); default payment method pre-selected (helpful, reduces friction).",
      },
      ttsSegments: [
        {
          enScript: "Defaults work because doing nothing is easier than doing something. That is why they are powerful, and why they must be honest. If the default is what most informed users would want, it is helpful. If it is what the company hopes users will not notice, it is a dark pattern.",
          zhRecap: "默认选项之所以有效，是因为什么都不做比做什么容易。所以它必须诚实。如果默认是多数知情用户会选的，它是帮助；如果是公司希望用户不注意的，它就是 dark pattern。",
          shadowingSentence: "Ethical defaults respect inertia; exploitative defaults abuse it.",
        },
      ],
      openQuestions: [
        {
          text: "Where is the line between a helpful default (e.g., pre-selecting the most popular plan) and a manipulative dark pattern (e.g., pre-checked insurance upsell)?",
          tags: ["defaults", "ethics", "dark-patterns"],
        },
      ],
      experimentHint: {
        hypothesis: "Transparently labeling the recommended plan ('Most Popular') increases its selection without reducing trust, while pre-checking upsells increases short-term revenue but reduces NPS.",
        notes: "A/B test recommendation labels vs. pre-checked add-ons. Primary metrics=plan selection distribution, revenue per user; guardrails=NPS, refund rate, complaint rate. Long-term measurement essential for dark pattern detection.",
      },
      rubric: "0=cannot identify defaults; 1=can identify defaults but cannot assess ethics; 2=can identify, classify ethical/dark pattern boundary, and propose transparent alternatives.",
    },

    // ===== D4: Mental Accounting / 心理账户 =====
    {
      day: 4,
      objectiveEn: "Compare promotion formats by perceived value, not only merchant cost.",
      objectiveZh: "能解释为什么相同补贴成本下，直降、满减、返券、赠品和积分会带来不同用户感知与指标结果。",
      oneLiner: "心理账户决定同样的钱被用户归到哪个「账本」。 / Mental accounting decides which mental ledger the same money lands in.",
      keyTerms: [
        {
          key: "mental-accounting",
          termEn: "Mental Accounting",
          termZh: "心理账户",
          definition: "Consumers sort money into different mental ledgers by source, purpose, and timing rather than treating it as fully fungible. / 用户按来源、用途、时间把钱分进不同心理账户，而非完全等价处理。",
          example: "A coupon feels different from an equivalent price cut.",
          tags: ["mental-accounting", "promotions"],
        },
        {
          key: "perceived-savings",
          termEn: "Perceived Savings",
          termZh: "感知节省",
          definition: "Subjective sense of how much was saved, which may diverge from actual merchant cost. / 用户主观感受到的节省，可能与商家实际成本不同。",
          example: "「Save ¥30 now」 may feel clearer than 「earn ¥30 future credit.」",
          tags: ["mental-accounting", "framing"],
        },
        {
          key: "threshold-promo",
          termEn: "Threshold Promotion",
          termZh: "满减门槛优惠",
          definition: "A discount that requires reaching a spending threshold. / 需要达到消费门槛才能享受的优惠。",
          example: "「Spend ¥299 to get ¥50 off」 can raise AOV but also create frustration.",
          tags: ["mental-accounting", "aov"],
        },
        {
          key: "coupon-wallet",
          termEn: "Coupon Wallet",
          termZh: "券包心理预算",
          definition: "The mental budget users assign to already-acquired coupons and future credits. / 用户对已领券/返券的心理预算。",
          example: "A future coupon may drive repeat purchase if it is easy to remember and use.",
          tags: ["mental-accounting", "repeat"],
        },
        {
          key: "subsidy-efficiency",
          termEn: "Subsidy Efficiency",
          termZh: "补贴效率",
          definition: "Effective business return per unit of subsidy cost. / 同等补贴带来的有效业务收益。",
          example: "A gift may lift conversion more cheaply than a price cut for non-standard goods.",
          tags: ["mental-accounting", "metrics"],
        },
      ],
      concepts: [
        {
          key: "mental_accounting_core",
          termEn: "Mental Accounting",
          termZh: "心理账户",
          keyQuote: "心理账户说明用户不会像财务模型一样把所有钱完全等价处理，而是按来源、用途、时间和「是否像白赚」分账户。Mental accounting means the same merchant cost can feel very different to the shopper.",
          explanation: "At equal merchant cost, a direct price cut feels like immediate savings (high CVR lift), a threshold discount feels like a reward for reaching a goal (AOV lift), a future coupon feels like tomorrow's budget (repeat purchase lift but weak immediate CVR), and a free gift feels like a bonus gain (strong for non-standard goods like beauty). Common mistake: comparing only merchant cost while ignoring whether users understand the rule, whether the threshold forces basket-stuffing, and whether coupons actually get redeemed.",
          reviewPrompt: "Why can two promotions with the same merchant cost produce very different business results?",
          reviewAnswer: "Because different promotion formats enter different mental accounts: direct cuts hit the immediate-savings account (CVR), threshold promotions hit the goal-reward account (AOV), future coupons hit the forward-budget account (repeat), and gifts hit the bonus-gain account (perceived value for non-standards). Each moves different metrics and carries different guardrails (margin, redemption rate, refund rate).",
          tags: ["mental-accounting", "core-concept"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "True or false: If two promotions cost the merchant the same amount, users will perceive them as equivalent.",
          answer: "False. Mental accounting changes subjective value; the same ¥20 feels different as a direct cut, threshold reward, future coupon, or free gift.",
        },
        {
          key: "st2",
          question: "What is the risk of issuing future coupons that users forget to use?",
          answer: "It may appear to save subsidy cost, but it hurts trust and repeat purchase if users feel the coupon was designed to be forgotten. Track redemption rate and set reminders.",
        },
      ],
      practice: {
        prompt: "Choose one category. Design four equal-cost promotions: direct price cut, threshold discount, future coupon, free gift. For each, write: mental account, expected metric lift, possible harm metric, and applicable scenario. Output: D4-promotion-mental-accounting-table.",
        exampleOutput: "Equal subsidy ¥20: direct cut=immediate-savings account, expected CVR+; threshold=goal-reward account, expected AOV+; future coupon=forward-budget account, expected repeat+ but weak immediate CVR; gift=bonus-gain account, good for beauty/non-standards. Guardrails=margin, refund rate, coupon silence rate.",
      },
      ttsSegments: [
        {
          enScript: "Mental accounting means the same merchant cost can feel very different to the shopper. A price cut, a threshold discount, a future coupon, and a free gift enter different mental buckets. Today, compare promotions by perceived value, business metric, and long-term guardrail. The cheapest subsidy is not always the most effective one.",
          zhRecap: "今天学同等补贴为什么不等价。直降、满减、返券、赠品进入用户不同心理账户，所以要同时看感知价值、指标和长期护栏。",
          shadowingSentence: "If a promotion matches the shopper's mental account, then we expect better subsidy efficiency, measured by margin-adjusted conversion and guarded by refund rate.",
        },
      ],
      experimentHint: {
        hypothesis: "Different equal-cost promotion formats will move different primary metrics (CVR vs. AOV vs. repeat) depending on which mental account they activate.",
        notes: "Control=current promotion; Variant A=direct cut; Variant B=one of threshold/gift/coupon (do not test too many at once). Primary metrics=pick 1-2 from CVR, AOV, margin, or repeat; guardrails=refund, complaints, coupon redemption, subsidy ROI. Duration=immediate metrics 7 days; coupon/repeat at least 30 days. Do not judge coupon effects on day-1 CVR alone.",
      },
      rubric: "0=only lists promotion types; 1=can write expected metrics but misses mental accounts and guardrails; 2=can compare equal-cost promotions by perceived value, metric impact, margin/repeat guardrails, and category fit.",
    },

    // ===== D5: Decoy Effect & Choice Overload / 诱饵效应与选择过载 =====
    {
      day: 5,
      objectiveEn: "Diagnose whether a page suffers from missing contrast or choice overload, and design a three-tier structure.",
      objectiveZh: "诱饵效应通过加入一个明显劣势但可解释的选项让目标选项更划算；选择过多增加决策成本，让用户推迟、随便选或退出。",
      oneLiner: "诱饵要帮助选择，不能把 SKU 货架变成迷宫。 / A decoy should aid choice, not turn the SKU shelf into a maze.",
      keyTerms: [
        {
          key: "decoy-effect",
          termEn: "Decoy Effect",
          termZh: "诱饵效应",
          definition: "Adding a clearly dominated option makes the target option more attractive. / 加入一个在关键维度上明显劣势的选项，让目标选项更有吸引力。",
          example: "A slightly worse middle bundle can increase the recommended bundle share.",
          tags: ["decoy", "choice-architecture"],
        },
        {
          key: "dominated-option",
          termEn: "Dominated Option",
          termZh: "被支配选项",
          definition: "An option that is clearly worse than another on key dimensions. / 在关键维度上明显不如另一个选项的选项。",
          example: "A bundle with less quantity but nearly the same price is dominated.",
          tags: ["decoy", "pricing"],
        },
        {
          key: "choice-overload",
          termEn: "Choice Overload",
          termZh: "选择过载",
          definition: "Too many options cause decision paralysis, deferral, or exit. / 选项过多导致决策延迟、随便选或退出。",
          example: "Ten similar SKUs make shoppers abandon the spec selector.",
          tags: ["choice-overload", "ux"],
        },
        {
          key: "decision-cost",
          termEn: "Decision Cost",
          termZh: "决策成本",
          definition: "The mental effort required to compare and choose among options. / 用户比较和选择所需的心理成本。",
          example: "Each additional bundle adds comparison effort.",
          tags: ["choice-overload", "cognitive-load"],
        },
        {
          key: "target-package-share",
          termEn: "Target Package Share",
          termZh: "目标档位选择占比",
          definition: "The share of users who select the recommended or target tier. / 选择推荐档或目标档的用户比例。",
          example: "The recommended plan share should rise if the structure is clearer.",
          tags: ["choice-architecture", "metrics"],
        },
      ],
      concepts: [
        {
          key: "decoy_core",
          termEn: "Decoy Effect and Choice Overload",
          termZh: "诱饵效应与选择过载",
          keyQuote: "诱饵效应和选择过载天然冲突：诱饵可能需要增加选项，降负荷可能需要减少选项。The decoy effect and choice overload often fight each other.",
          explanation: "The decoy effect works when a clearly dominated (but explainable) option makes the target option feel like the obvious choice. Choice overload works the opposite way: every additional option adds comparison cost, and past a threshold users defer, pick randomly, or exit. These two forces conflict: adding a decoy can help when the choice set is small (2-3 options) but hurts when users already face 8-12 SKUs. Common mistakes: adding a fake/implausible decoy that destroys trust, or adding a decoy to an already-overloaded page.",
          reviewPrompt: "When should you add a decoy, and when should you simplify instead?",
          reviewAnswer: "Add a decoy only when the choice set is small (2-3 options) and the target option is clear. When users already face many SKUs or bundles (8-12+), simplify first (e.g., three-tier structure with expand-more). A decoy must be explainable and plausible; a fake tier destroys trust.",
          tags: ["decoy", "choice-overload", "core-concept"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "True or false: The more options you add, the stronger the decoy effect.",
          answer: "False. Too many options dilute comparison and increase exit risk. Decoys work best in small choice sets (2-3 options).",
        },
        {
          key: "st2",
          question: "Why must a decoy option be explainable?",
          answer: "An obviously fake or implausible decoy makes users feel manipulated and destroys trust in the brand's pricing.",
        },
      ],
      practice: {
        prompt: "Count the SKUs, bundles, spec options, and recommendation slots on one page. Diagnose: missing contrast / choice overload / both / neither. Output D5-SKU decision-load audit, and sketch a three-tier structure.",
        exampleOutput: "Current 9 bundles displayed flat; spec-completion rate low; CS frequently asked 「which one should I buy.」 Diagnosis=choice overload first, do not add decoy. Solution=3 recommended tiers + expand more; premium tier as credible anchor, recommended tier highlights value. Primary metrics=spec completion rate, recommended-tier share; guardrails=refund rate, AOV.",
      },
      ttsSegments: [
        {
          enScript: "The decoy effect and choice overload often fight each other. A decoy can help when the choice set is small and the target option is clear. But when users already face too many bundles, another option only adds cost. Today, count the options first. Then decide whether the page needs contrast, simplification, or a cleaner three-tier structure.",
          zhRecap: "今天练的是「先判断瓶颈」。如果用户已经选不动，就不要为了用诱饵再加选项；先把结构收敛到用户能比较。",
          shadowingSentence: "If choice overload is the main bottleneck, then we expect simplification to improve package completion, measured by package completion rate and guarded by refund rate.",
        },
      ],
      experimentHint: {
        hypothesis: "A three-tier structure (basic/recommended/premium) outperforms a flat list of 9 bundles when choice overload is the primary bottleneck.",
        notes: "Control=current SKU/bundle structure; Variant=clear three-tier structure. If testing a decoy, only add an explainable dominated option within the three tiers. Primary metrics=spec completion rate, target-tier share, payment CVR; guardrails=AOV, refund rate, CS tickets about 「which to buy.」 Duration at least 7 days. When SKU count is high and traffic is split thin, do not over-stratify by product.",
      },
      rubric: "0=only says 「too many SKUs」 or 「add a decoy」; 1=can count options but cannot diagnose primary bottleneck; 2=can prioritize decoy vs. overload, design a three-tier structure, and bind primary metrics and guardrails.",
    },

    // ===== D6: Weekend Integration 1A: Behavioral Economics Diagnosis / 周末整合 1A =====
    {
      day: 6,
      objectiveEn: "Diagnose a pricing or bundle problem using behavioral-economics mechanisms and competing explanations.",
      objectiveZh: "把 D1-D5 的价格、优惠、默认项、心理账户和选择结构合成一次业务诊断，找出最可能的方向性问题。",
      oneLiner: "周末第一天不是复习名词，而是从业务问题倒推心理假设。 / Integration day one starts from the business problem, not from the concept list.",
      keyTerms: [
        {
          key: "competing-explanation",
          termEn: "Competing Explanation",
          termZh: "竞争解释",
          definition: "A non-psychological cause that could explain the same observed metric. / 能解释同一指标现象的非心理原因。",
          example: "Traffic quality, product mix, and stockouts may explain low conversion.",
          tags: ["diagnosis", "methodology"],
        },
        {
          key: "directional-problem",
          termEn: "Directional Problem",
          termZh: "方向性问题",
          definition: "A problem that points to a strategic direction rather than a local UI preference. / 指向策略方向的问题，不是局部 UI 偏好。",
          example: "「Users cannot compare bundles」 is directional; 「button is small」 may not be.",
          tags: ["diagnosis", "strategy"],
        },
        {
          key: "evidence-snapshot",
          termEn: "Evidence Snapshot",
          termZh: "证据快照",
          definition: "A quick assembly of current evidence before hypothesizing. / 当前证据的快速整理。",
          example: "Funnel data, page observation, customer questions, and past experiments.",
          tags: ["diagnosis", "evidence"],
        },
        {
          key: "mechanism-fit",
          termEn: "Mechanism Fit",
          termZh: "机制匹配度",
          definition: "How well a psychological mechanism matches the observed business bottleneck. / 心理机制与业务断点的匹配度。",
          example: "Choice overload fits high spec-selector exits better than scarcity does.",
          tags: ["diagnosis", "methodology"],
        },
      ],
      concepts: [
        {
          key: "diagnosis_core",
          termEn: "Behavioral Economics Diagnosis",
          termZh: "行为经济学诊断",
          keyQuote: "不要为了用概念而用概念，要从业务问题、证据和竞争解释出发。Do not ask which psychology concept you can use; ask what business problem you are solving.",
          explanation: "Weekend integration is not a vocabulary quiz. Start from a real business problem (e.g., AOV is low, spec completion is low, cart abandonment is high). Gather evidence (funnel data, page observation, CS tickets, past experiments). List candidate psychological mechanisms (anchoring, loss aversion, defaults, mental accounting, decoy/overload) AND competing explanations (price band, product quality, traffic quality, stock structure). Then identify the primary bottleneck and explicitly list what you are NOT treating now. Common mistake: attributing every metric problem to 「copy isn't urgent enough」 without checking competing explanations.",
          reviewPrompt: "What is the diagnostic flow for applying behavioral economics to a real e-commerce problem?",
          reviewAnswer: "Business problem → evidence snapshot → candidate psychological mechanisms → competing (non-psychological) explanations → primary bottleneck judgment → explicitly deprioritized items. The key is writing competing explanations before concluding, to prevent psychology from becoming a universal justification.",
          tags: ["diagnosis", "integration", "core-concept"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "True or false: Weekend integration means writing a one-sentence definition for each concept from D1-D5.",
          answer: "False. It means applying concepts to a real business diagnosis with evidence and competing explanations.",
        },
        {
          key: "st2",
          question: "Why should you write competing explanations even if they weaken your preferred psychological hypothesis?",
          answer: "Competing explanations prevent psychology from becoming a universal justification. If a non-psychological cause (e.g., stockout, traffic quality) better explains the metric, the psychology intervention will fail.",
        },
      ],
      practice: {
        prompt: "Take a recent campaign or page. Write one page of diagnosis following: business problem → evidence → candidate psychological mechanisms → competing explanations → primary bottleneck → deprioritized items. Output: D6-behavioral-economics-diagnosis-page.",
        exampleOutput: "Business problem=AOV low. Evidence=users mostly buy basic tier, bundle-page exit high. Candidate mechanisms=weak anchor, choice overload, mental accounting. Competing explanations=premium SKU out of stock, traffic skews to price-sensitive segment. Primary bottleneck=bundle structure unclear. Deprioritized=countdown timer, because urgency is not the bottleneck.",
      },
      ttsSegments: [
        {
          enScript: "Integration begins with diagnosis. Do not ask which psychology concept you can use. Ask what business problem you are solving, what evidence you have, and what else could explain the same result. Today, use the first five days to find the main behavioral-economics bottleneck before designing a test.",
          zhRecap: "周末第一天先诊断。不要为了用概念而用概念，要从业务问题、证据和竞争解释出发，找到最可能的方向性问题。",
          shadowingSentence: "If the main bottleneck is bundle confusion, then we expect a bundle-structure test to be more relevant than an urgency-copy test.",
        },
      ],
      resolvedQuestions: [
        {
          question: "Why do we need competing explanations if we already have a plausible psychological mechanism?",
          answer: "Because a plausible mechanism can still be wrong. If low AOV is caused by premium SKU stockouts rather than weak anchoring, an anchoring intervention will not move the metric. Competing explanations force us to check non-psychological causes before investing in a psychology-based change.",
          tags: ["diagnosis", "methodology"],
        },
      ],
      experimentHint: {
        hypothesis: "Diagnosis-first approach (identifying primary bottleneck before designing experiments) produces higher-win-rate experiments than concept-first approach.",
        notes: "D6 does not launch an experiment yet; it identifies the highest-leverage direction. Primary metric follows the bottleneck: price anchoring→target-tier share; promotion accounting→AOV/margin; defaults→payment completion; choice structure→spec completion. Guardrails=refund, complaints, payment CVR. Duration=first use 7 days of historical data/page observation for diagnosis, then set D7 brief for front-end 7-14 days, post-purchase 14-30 days. Pick high-traffic core pages for directional tests; do not over-diagnose on low-traffic long-tail pages.",
      },
      rubric: "0=only concept recitation; 1=can list candidate mechanisms but lacks evidence and competing explanations; 2=can use evidence to locate the primary bottleneck, explain why certain mechanisms are deprioritized, and derive the next day's brief direction.",
    },

    // ===== D7: Weekend Integration 1B: Checklist v1 & Experiment Brief / 周末整合 1B =====
    {
      day: 7,
      objectiveEn: "Convert a behavioral-economics diagnosis into a reviewable checklist and a testable experiment brief.",
      objectiveZh: "把 D6 诊断转成第一版决策前 checklist 和一个可评审的实验 brief 草案。",
      oneLiner: "Checklist v1 的价值在于逼你先写竞争解释。 / The value of Checklist v1 is forcing you to write competing explanations before you test.",
      keyTerms: [
        {
          key: "decision-checklist",
          termEn: "Decision Checklist",
          termZh: "决策清单",
          definition: "A pre-experiment checklist of questions that must be answered before launching. / 实验前必须检查的问题清单。",
          example: "Check anchor credibility, default risk, and choice overload before changing bundles.",
          tags: ["checklist", "methodology"],
        },
        {
          key: "experiment-brief",
          termEn: "Experiment Brief",
          termZh: "实验 Brief",
          definition: "A reviewable plan stating hypothesis, variant, metrics, guardrails, and failure interpretation. / 把假设、方案、指标、护栏写成可评审计划。",
          example: "Test three bundle tiers against the current nine-tier structure.",
          tags: ["experiment", "methodology"],
        },
        {
          key: "variable-isolation",
          termEn: "Variable Isolation",
          termZh: "变量隔离",
          definition: "Changing only the key mechanism to avoid confounding multiple variables. / 尽量只改变关键机制，避免混杂。",
          example: "Do not change price, image, and bundle structure in the same test.",
          tags: ["experiment", "rigor"],
        },
        {
          key: "guardrail-metric",
          termEn: "Guardrail Metric",
          termZh: "护栏指标",
          definition: "A metric that prevents short-term wins from masking long-term harm. / 防止短期胜利掩盖长期副作用的指标。",
          example: "Refund and complaint rates guard a conversion lift.",
          tags: ["experiment", "metrics"],
        },
        {
          key: "failure-interpretation",
          termEn: "Failure Interpretation",
          termZh: "失败解释",
          definition: "Pre-written interpretation of what a failed result would mean, written before seeing data. / 实验失败后如何记录边界，提前写好而非事后圆。",
          example: "If simplification fails, traffic price sensitivity may be the competing cause.",
          tags: ["experiment", "rigor"],
        },
      ],
      concepts: [
        {
          key: "brief_core",
          termEn: "Checklist v1 and Experiment Brief",
          termZh: "Checklist v1 与实验 Brief 草案",
          keyQuote: "把「我觉得有道理」变成「别人可以评审」。Turn 「this makes sense to me」 into 「this is reviewable by others.」",
          explanation: "A qualified experiment brief must state: background, psychological mechanism, competing explanations, Control, Variant, the single variable changed, primary metrics (1-2), guardrail metrics (at least 2), duration, and a pre-written failure interpretation. It must also include a 「what we will NOT do」 section. Common mistake: writing a laundry list of optimizations (change price, image, title, coupon, CTA all at once) — even if it wins, you learn nothing about which mechanism worked.",
          reviewPrompt: "What makes an experiment brief reviewable rather than a wish list?",
          reviewAnswer: "A reviewable brief isolates one behavioral mechanism, states Control and Variant clearly, names 1-2 primary metrics and at least 2 guardrails, sets duration, pre-writes failure interpretation, and explicitly lists what will NOT be changed. A wish list changes many things at once and produces uninterpretable results.",
          tags: ["experiment", "integration", "core-concept"],
        },
      ],
      selfTest: [
        {
          key: "st1",
          question: "True or false: An experiment that changes title, hero image, price, and bundles simultaneously can prove choice architecture works if it wins.",
          answer: "False. Confounded variables make it impossible to attribute the win to any single mechanism.",
        },
        {
          key: "st2",
          question: "Why should you write the failure interpretation before running the experiment rather than after?",
          answer: "Writing it beforehand prevents post-hoc storytelling. If you pre-commit to what failure means, you learn cleaner boundaries instead of rationalizing after the fact.",
        },
      ],
      practice: {
        prompt: "Using decision-checklist.md and experiment-brief.md templates, complete Checklist v1 and Experiment Brief v1. Must include one 「what we will NOT do」 item and one 「what data would prove me wrong」 item.",
        exampleOutput: "Will NOT do=add more recommendation slots (D6 diagnosed choice overload). Brief: Control=current 9 bundles; Variant=3 recommended tiers + expand more; only change=bundle choice architecture; primary metrics=spec completion rate / target-tier share; guardrails=payment CVR, AOV, refund; failure interpretation=price band or traffic segment is the real cause.",
      },
      ttsSegments: [
        {
          enScript: "A checklist protects the decision before the experiment starts. A brief protects the learning after the experiment ends. Today, turn your diagnosis into one testable plan. Say what you will change, what you will not change, what metric decides success, and what result would prove your hypothesis wrong.",
          zhRecap: "周末第二天把诊断变成 checklist 和 brief。真正合格的方案要能被别人评审，也要能在失败时留下清楚边界。",
          shadowingSentence: "If the brief isolates one behavioral mechanism, then we expect cleaner learning, measured by interpretable results and guarded by long-term metrics.",
        },
      ],
      openQuestions: [
        {
          text: "How do you decide the minimum detectable effect (MDE) and sample size for a behavioral-economics experiment when the expected lift is small (e.g., 2-5% on CVR)?",
          tags: ["experiment", "statistics", "methodology"],
        },
      ],
      experimentHint: {
        hypothesis: "A reviewable brief (isolated variable, pre-written guardrails and failure interpretation) produces more interpretable outcomes than a multi-change 「laundry list」 test.",
        notes: "Control=current plan; Variant=single-direction change from D6 diagnosis. Primary metrics max 1-2; guardrails at least 2; duration=front-end metrics 7-14 days, refund/complaints 14-30 days. Sample-size awareness=if current page traffic is too low, expand to similar SKUs or run usability testing first; do not force multiple variants on thin traffic.",
      },
      rubric: "0=only optimization wishes; 1=has Control/Variant but lacks variable isolation, guardrails, or failure interpretation; 2=Checklist and brief are ready for product/data review with clear primary metrics, guardrails, duration, and explicitly deprioritized items.",
    },
  ],
};
