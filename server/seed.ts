import { db } from "./db";
import { courses, lessons, lessonProgress } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase(userId: string) {
  // Check if user already has courses
  const existingCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.userId, userId))
    .limit(1);

  if (existingCourses.length > 0) {
    return; // Already seeded for this user
  }

  // Create sample course 1: AI Economics 101
  const [course1] = await db
    .insert(courses)
    .values({
      userId,
      title: "AI Economics 101",
      description: "Understanding the economic impact of artificial intelligence on labor markets and productivity",
      totalLessons: 10,
      isCompleted: false,
    })
    .returning();

  const aiLessons = [
    {
      sessionNumber: 1,
      title: "The Automation Anxiety Cycle",
      subtitle: "Why fears about AI and jobs echo past technological shifts",
      content: `Every major technological shift in history has sparked fears about mass unemployment. When the printing press emerged in the 15th century, scribes worried their livelihoods would vanish. When power looms revolutionized textile production, the Luddites literally smashed machines in protest. When ATMs appeared, bank tellers braced for obsolescence.

Yet here we are, with more jobs than ever before. Each wave of automation ultimately created more employment than it destroyed—though not without painful transitions and not evenly distributed across all workers.

So what makes AI different? Three factors stand out.

First, the scope is unprecedented. Previous automation waves targeted specific manual tasks—weaving, calculating, assembly. AI, however, can potentially automate cognitive work across virtually every industry simultaneously.

Second, the pace is accelerating. The gap between AI breakthroughs and their commercial deployment is shrinking from decades to years to months. Workers have less time to adapt.

Third, AI can improve itself. Unlike a loom or an ATM, AI systems can be trained to handle increasingly complex tasks, potentially climbing the skill ladder faster than humans can retrain.

But history offers another lesson: technology's impact on jobs depends heavily on choices made by businesses, governments, and workers themselves. The same technology can either concentrate wealth or distribute prosperity, depending on how it's deployed and regulated.

In this course, we'll explore these dynamics in depth, examining both the threats and opportunities AI presents for the future of work.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 2,
      title: "Measuring AI's Economic Footprint",
      subtitle: "How economists track AI adoption and its ripple effects",
      content: `Measuring AI's economic impact is surprisingly tricky. Unlike physical machines that can be counted and tracked, AI is often embedded invisibly in existing systems—a recommendation algorithm here, a fraud detection model there.

Economists use several approaches to gauge AI's footprint. Patent analysis reveals research intensity: AI-related patents have grown exponentially since 2010. Job posting data shows demand for AI skills: mentions of machine learning in listings quintupled between 2015 and 2023.

Corporate investment tells another story. Companies spent over $150 billion on AI in 2023, with that figure expected to double by 2027. But investment doesn't automatically translate to productivity—many AI projects fail or underperform.

Sector-by-sector analysis reveals uneven adoption. Financial services and tech lead the pack, with manufacturing and retail close behind. Healthcare shows enormous potential but faces regulatory hurdles. Education and government lag, constrained by budgets and institutional inertia.

Geographic patterns matter too. The United States and China dominate AI development, accounting for roughly 80% of global investment. Europe trails, focusing more on regulation than innovation. Developing nations face a growing "AI divide" that could exacerbate existing inequalities.

Perhaps most important is measuring actual productivity gains. Here, the evidence is mixed. Some companies report dramatic efficiency improvements; others see modest returns or outright failures. Aggregate productivity statistics haven't yet shown the transformative gains many predicted.

This "productivity paradox"—why powerful technology isn't showing up in economic statistics—will be our focus in the next lesson.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 3,
      title: "Labor Market Disruption Patterns",
      subtitle: "Which jobs are most vulnerable, and emerging roles AI creates",
      content: `Not all jobs face equal risk from AI automation. Understanding the patterns of disruption can help workers and policymakers prepare.

Routine cognitive tasks face the highest near-term risk. Data entry, basic customer service, simple legal research, and standard financial analysis are already being automated. These jobs share a common trait: they follow predictable rules that can be encoded into algorithms.

Surprisingly, some high-skill professions face significant disruption. Radiologists, paralegals, and entry-level programmers perform tasks that AI can increasingly handle. The key vulnerability isn't wage level but task structure—predictable, pattern-based work is automatable regardless of its complexity.

Jobs requiring physical dexterity in unstructured environments remain harder to automate. Plumbers, electricians, and construction workers perform tasks that require spatial reasoning and adaptability that robots still struggle with.

Interpersonal work also shows resilience. Therapists, teachers, and healthcare providers rely on emotional intelligence and human connection that AI cannot replicate—though AI tools may change how these professionals work.

But automation doesn't just destroy jobs; it creates them. Every technological revolution has spawned entirely new categories of work. AI is no different. Data scientists, AI trainers, prompt engineers, and ethics officers barely existed a decade ago.

The challenge isn't that jobs will disappear entirely, but that the transition will be uneven. Workers in automated roles need pathways to new opportunities. The question is whether our institutions—education systems, labor markets, social safety nets—can adapt quickly enough.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 4,
      title: "The Productivity Paradox",
      subtitle: "Why AI gains aren't showing up in productivity metrics",
      content: `In 1987, economist Robert Solow famously quipped, "You can see the computer age everywhere but in the productivity statistics." Nearly four decades later, we face a similar puzzle with AI.

Despite massive investments in AI technology, aggregate productivity growth in developed economies remains sluggish. U.S. productivity growth averaged just 1.4% annually from 2010 to 2022—well below historical norms. What explains this paradox?

Several theories compete for attention.

The measurement hypothesis suggests we're simply not capturing AI's benefits in traditional statistics. When Google Maps saves you 15 minutes of commute time, GDP doesn't change. When AI improves medical diagnoses, we count treatments but not quality of life. Our economic metrics may be outdated.

The diffusion lag theory argues that transformative technologies take decades to fully permeate the economy. Electricity was invented in the 1880s but didn't revolutionize manufacturing until the 1920s, when factories were redesigned around electric motors. AI may require similar organizational transformation.

The concentration thesis notes that AI benefits flow disproportionately to a small number of firms and workers. A handful of tech giants capture enormous value, but this doesn't necessarily raise average productivity across the economy.

Finally, the complexity argument suggests that AI's biggest impacts are yet to come. Current AI excels at narrow tasks; future systems may transform entire industries. We're still in the "installation phase," not the "deployment phase."

The truth likely combines all these factors. But the productivity paradox has real consequences: it fuels skepticism about AI's transformative potential and complicates policy debates about automation and jobs.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 5,
      title: "Wage Effects & Income Inequality",
      subtitle: "How AI automation reshapes earnings distribution",
      content: `The relationship between AI and wages is complex and often counterintuitive. Simple predictions—"AI will drive down all wages" or "AI will raise all boats"—miss the nuanced reality.

For some workers, AI acts as a complement, making their work more valuable. Analysts using AI tools can process more data. Designers using generative AI can iterate faster. Programmers with AI assistants write code more efficiently. These workers often see productivity gains that translate to higher earnings.

For others, AI is a substitute. When AI can perform a task entirely, workers in that role lose bargaining power. Call center agents, data entry clerks, and routine programmers face downward wage pressure as employers gain automation alternatives.

This creates what economists call "skill-biased technological change"—but with a twist. Traditional theories suggested technology rewards education; AI often rewards specific skills that don't map neatly to formal credentials. A graphic designer who masters AI tools may thrive while a PhD economist doing routine modeling struggles.

The net effect on income inequality is concerning. Early evidence suggests AI concentration among elite firms and workers is widening the gap between winners and losers. The top 10% of workers have seen earnings grow while the middle class stagnates.

Geographic effects compound these patterns. AI development clusters in a few superstar cities—San Francisco, Seattle, Austin, Boston. Workers in these regions benefit; those elsewhere face automation without access to new opportunities.

Policy responses are emerging: portable benefits, wage subsidies, regional development programs. But the scale of potential disruption may require more fundamental reforms to how we connect work, income, and economic security.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 6,
      title: "Geographic Winners & Losers",
      subtitle: "Which regions gain or lose from AI adoption",
      content: `AI's economic impact isn't distributed evenly across the map. Some regions are positioned to thrive; others face wrenching transitions.

The San Francisco Bay Area stands as AI's undisputed capital. Silicon Valley combines research universities, venture capital, tech giants, and entrepreneurial culture in an unmatched ecosystem. Nearly half of global AI startup funding flows through the region.

Other technology hubs benefit from proximity effects. Seattle (Amazon, Microsoft), Austin (emerging hub), Boston (MIT, biotech), and New York (finance, media) attract AI talent and investment. These metros offer the density of expertise that AI development requires.

But concentration has costs. Housing becomes unaffordable as high-paying AI jobs bid up prices. Local service workers are squeezed out. Traffic, homelessness, and inequality strain urban infrastructure. The prosperity isn't broadly shared even within winning regions.

Regions that specialized in routine cognitive work face the steepest challenges. Call center cities, back-office hubs, and manufacturing towns dependent on routine assembly are vulnerable. Some developing countries that built economies on business process outsourcing—India, Philippines—must navigate AI disruption at earlier stages of development.

Rural areas face a double bind: fewer opportunities to begin with, and remote work that could theoretically connect them to global markets remains concentrated among already-advantaged workers.

Policy experiments offer some hope. Regional innovation initiatives, remote work incentives, and place-based industrial policy can help. But reversing decades of geographic polarization will require sustained commitment and significant resources.

The question isn't just where AI jobs will be, but what happens to communities left behind.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 7,
      title: "The Skills Premium Shift",
      subtitle: "What capabilities command value in an AI economy",
      content: `For decades, the labor market rewarded education. College graduates earned more than high school graduates; graduate degrees commanded further premiums. AI is scrambling this equation.

The new skills premium isn't about credentials—it's about capabilities that complement AI.

Problem framing matters more than problem solving. AI can execute solutions, but humans must define what problems to solve and why they matter. Strategic thinking, ethical judgment, and contextual understanding become premium skills.

Communication and persuasion gain value. AI can generate text, but humans must build trust, navigate politics, and inspire action. Salespeople who understand customer psychology, executives who can rally teams, and leaders who can articulate vision remain essential.

Creative synthesis—combining ideas from diverse domains—is hard to automate. AI excels at pattern matching within defined spaces; humans excel at connecting disparate fields in novel ways. The scientist who sees connections between biology and economics, or the designer who blends architecture and psychology, creates value AI cannot.

Technical literacy becomes table stakes. Not everyone needs to code, but understanding what AI can and cannot do, how to work with AI tools, and when to trust automated recommendations becomes essential across occupations.

Emotional intelligence and social skills also appreciate. Care work, therapy, teaching, and leadership all require human connection that AI cannot substitute—though AI may augment how these professionals work.

The challenge is that educational systems are slow to adapt. Traditional curricula emphasize knowledge acquisition that AI can now provide instantly. The future demands learning how to learn, how to collaborate with AI, and how to apply judgment in complex situations.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 8,
      title: "Industry Deep Dive: Healthcare",
      subtitle: "AI in medical diagnosis and drug discovery",
      content: `Healthcare represents both AI's greatest promise and its most complex challenges. The industry's combination of high stakes, data intensity, and human impact makes it a crucial case study.

Diagnostic AI is already outperforming humans in narrow tasks. AI systems can identify diabetic retinopathy, detect certain cancers in radiology images, and predict patient deterioration from vital signs. These applications don't replace physicians but augment their capabilities.

Drug discovery is being transformed. Traditional drug development takes 10-15 years and costs billions. AI can dramatically accelerate early-stage discovery by predicting molecular interactions, identifying promising compounds, and optimizing clinical trial design. Several AI-discovered drugs are now in human trials.

Administrative automation offers perhaps the most immediate impact. Healthcare's paperwork burden is legendary—clinicians spend more time on documentation than patient care. AI can automate coding, transcription, prior authorizations, and scheduling, potentially freeing doctors and nurses to focus on healing.

But barriers remain formidable. Regulatory approval for AI-assisted diagnosis is slow and cautious—appropriately, given the stakes. Data privacy concerns limit AI's access to the comprehensive information needed for training. Liability frameworks for AI errors remain unclear.

Workforce implications are mixed. Some specialties—radiology, pathology—face automation pressure. But overall healthcare demand will grow as populations age. The net effect may be AI augmenting rather than replacing most healthcare workers.

The deeper question is whether AI's benefits will be broadly shared. Will AI-enhanced care reach underserved communities? Will efficiency gains translate to lower costs or higher profits? Policy choices will shape the answers.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 9,
      title: "Policy Responses",
      subtitle: "How governments are adapting to AI disruption",
      content: `Governments worldwide are grappling with how to harness AI's benefits while managing its disruptions. Policy responses span regulation, investment, education, and social protection.

Regulation approaches vary dramatically. The European Union leads with comprehensive frameworks emphasizing rights, safety, and transparency. The AI Act classifies applications by risk level, banning some uses and requiring oversight for others. China combines heavy investment with strict content controls. The United States has taken a lighter touch, emphasizing innovation while relying on existing laws.

Industrial policy is resurgent. Countries are racing to secure AI supply chains, from semiconductor manufacturing to cloud computing infrastructure. The U.S. CHIPS Act, European Digital Sovereignty initiatives, and China's self-sufficiency push represent massive bets on AI's strategic importance.

Education reform lags the technology. Policymakers discuss teaching coding, computational thinking, and AI literacy, but curricula and teaching capacity evolve slowly. Some countries experiment with lifelong learning accounts and employer training requirements; most are still designing frameworks.

Social safety nets face strain. Existing unemployment insurance assumes temporary layoffs followed by similar jobs. AI disruption may require more fundamental transitions. Universal basic income experiments, portable benefits systems, and wage subsidies for workers in transition are being piloted.

Tax policy may need rethinking. Labor is taxed heavily; capital and AI investments receive favorable treatment. Some economists argue for "robot taxes" to level the playing field; others warn such taxes would slow beneficial automation.

No consensus has emerged on optimal policy. But the debate is shifting from whether to act to how and how quickly. AI's acceleration is forcing governments to move faster than institutional processes typically allow.`,
      estimatedMinutes: 5,
    },
    {
      sessionNumber: 10,
      title: "Scenarios for the Future",
      subtitle: "Exploring possible AI economic outcomes",
      content: `Predicting AI's long-term economic impact requires humility. The range of possible outcomes spans utopia to dystopia, with reality likely landing somewhere in between. Let's explore three scenarios.

Scenario One: AI Abundance. AI dramatically raises productivity, creating unprecedented wealth. New jobs emerge faster than old ones disappear. Shorter workweeks become possible as machines handle more labor. Governments redistribute productivity gains through education, healthcare, and basic services. Inequality narrows as technology's benefits spread.

Scenario Two: AI Polarization. AI concentrates wealth among a small elite: AI companies, their employees, and investors. Middle-skill jobs erode while low-wage service work persists. Geographic polarization intensifies—superstar cities thrive while most regions stagnate. Political backlash grows as majorities feel left behind. Governments struggle to adapt institutions designed for industrial-era economies.

Scenario Three: Managed Transition. Societies recognize AI's disruptive potential early and invest heavily in adaptation. Robust retraining programs, portable benefits, and regional development initiatives smooth the transition. Regulation ensures AI is developed safely and its benefits shared broadly. Growth is slower than technologists hope but more equitable than pessimists fear.

Which scenario unfolds depends less on technology than on choices. How will businesses deploy AI—to replace workers or augment them? How will governments invest—in managing disruption or ignoring it? How will workers adapt—by resisting change or embracing new opportunities?

History suggests we'll muddle through, combining elements of all three scenarios. The path from technological breakthrough to economic transformation is always messier than predictions suggest.

But one thing is clear: AI's economic impact will be profound. Understanding these dynamics isn't optional—it's essential for navigating the decades ahead.`,
      estimatedMinutes: 5,
    },
  ];

  for (const lesson of aiLessons) {
    await db.insert(lessons).values({
      courseId: course1.id,
      ...lesson,
    });
  }

  // Mark first 4 lessons as completed for demo
  const course1Lessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, course1.id));

  for (let i = 0; i < 4 && i < course1Lessons.length; i++) {
    await db.insert(lessonProgress).values({
      userId,
      lessonId: course1Lessons[i].id,
      courseId: course1.id,
      isCompleted: true,
      completedAt: new Date(),
    });
  }

  // Create sample course 2: Climate Science Fundamentals (completed)
  const [course2] = await db
    .insert(courses)
    .values({
      userId,
      title: "Climate Science Fundamentals",
      description: "A deep dive into climate systems, feedback loops, and the science behind global warming",
      totalLessons: 8,
      isCompleted: true,
    })
    .returning();

  const climateLessons = [
    { sessionNumber: 1, title: "Earth's Energy Balance", subtitle: "How the sun's energy powers our climate", content: "Understanding Earth's climate starts with energy...", estimatedMinutes: 5 },
    { sessionNumber: 2, title: "The Greenhouse Effect", subtitle: "Natural warming that makes Earth habitable", content: "The greenhouse effect is often misunderstood...", estimatedMinutes: 5 },
    { sessionNumber: 3, title: "Carbon Cycle Basics", subtitle: "How carbon moves through Earth's systems", content: "Carbon is the building block of life...", estimatedMinutes: 5 },
    { sessionNumber: 4, title: "Ocean's Role in Climate", subtitle: "The great heat sink and carbon reservoir", content: "Oceans absorb enormous amounts of heat...", estimatedMinutes: 5 },
    { sessionNumber: 5, title: "Ice & Albedo", subtitle: "How reflectivity affects temperature", content: "White surfaces reflect sunlight...", estimatedMinutes: 5 },
    { sessionNumber: 6, title: "Climate Feedback Loops", subtitle: "Amplifying and dampening effects", content: "Climate feedbacks can accelerate or slow changes...", estimatedMinutes: 5 },
    { sessionNumber: 7, title: "Evidence of Change", subtitle: "Data from ice cores, satellites, and sensors", content: "Multiple lines of evidence confirm warming...", estimatedMinutes: 5 },
    { sessionNumber: 8, title: "Future Projections", subtitle: "Modeling what comes next", content: "Climate models simulate Earth's systems...", estimatedMinutes: 5 },
  ];

  for (const lesson of climateLessons) {
    await db.insert(lessons).values({
      courseId: course2.id,
      ...lesson,
    });
  }

  // Mark all lessons as completed
  const course2Lessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, course2.id));

  for (const lesson of course2Lessons) {
    await db.insert(lessonProgress).values({
      userId,
      lessonId: lesson.id,
      courseId: course2.id,
      isCompleted: true,
      completedAt: new Date(),
    });
  }

  console.log(`Seeded courses for user ${userId}`);
}
