import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="text-center mb-12">
        <h1 className="heading">NextJS Setup</h1>
        <p className="muted">Modern web application with authentication and payments</p>
      </header>

      <main className="space-y-8">
        <section>
          <h2 className="subheading mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="title mb-2"> Authentication</h3>
              <p className="body mb-3">
                Firebase Auth with email/password and Google OAuth
              </p>
              <div className="space-x-2">
                <Link href="/login">
                  <Button size="sm">Login</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" variant="outline">Sign Up</Button>
                </Link>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="title mb-2">Payments</h3>
              <p className="body mb-3">
                Secure PayU gateway integration with multiple payment methods
              </p>
              <Link href="/checkout">
                <Button size="sm">Checkout</Button>
              </Link>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="title mb-2"> Profile Management</h3>
              <p className="body mb-3">
                User profile, password change, and account management
              </p>
              <Link href="/profile">
                <Button size="sm" variant="outline">View Profile</Button>
              </Link>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="title mb-2"> Modern Stack</h3>
              <p className="body">
                Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
              </p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <Link href="/login">
            <Button>Get Started</Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
