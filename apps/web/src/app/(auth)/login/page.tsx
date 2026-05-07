import { LoginForm } from './login-form.client';
import { DemoCredentials } from '@/components/demo-credentials';

export const metadata = {
  title: 'Connexion — TAP Régulation',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-24 bg-background">
      <div className="w-full max-w-[400px] space-y-32">
        <header className="text-center space-y-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            TAP Régulation
          </h1>
          <p className="text-muted-foreground text-sm">
            Connectez-vous pour accéder au référentiel patient.
          </p>
        </header>
        <LoginForm next={searchParams.next} />
        <DemoCredentials />
      </div>
    </div>
  );
}
