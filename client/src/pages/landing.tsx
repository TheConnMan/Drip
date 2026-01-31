import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Drip" className="w-8 h-8 rounded-md" />
            <span className="font-semibold text-lg" data-testid="text-logo">Drip</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Learning</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Learn anything,{" "}
              <span className="text-primary">one bite at a time</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Tell us what you want to learn, and our AI creates personalized micro-lessons 
              tailored to your pace. Track progress, expand topics, and master new skills daily.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login">Get Started Free</a>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-learn-more">
                <a href="#features">Learn More</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required
            </p>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-20 border-t border-border/50">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Drip?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We break down complex topics into digestible daily lessons, 
              making learning sustainable and enjoyable.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="p-6 hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Generated Content</h3>
              <p className="text-muted-foreground text-sm">
                Our AI creates custom lessons on any topic. Just describe what you want to learn, 
                and get a full course in seconds.
              </p>
            </Card>
            <Card className="p-6 hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Progress Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Track your learning journey with visual progress indicators. 
                See how far you've come and what's next.
              </p>
            </Card>
            <Card className="p-6 hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Deep Dive Expansions</h3>
              <p className="text-muted-foreground text-sm">
                Want to know more? Expand any topic with a single click for 
                in-depth explanations and examples.
              </p>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 border-t border-border/50">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to start learning?</h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of learners who are mastering new skills every day with Drip.
            </p>
            <Button size="lg" asChild data-testid="button-cta-start">
              <a href="/api/login">Start Learning Now</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with AI for curious minds</p>
        </div>
      </footer>
    </div>
  );
}
