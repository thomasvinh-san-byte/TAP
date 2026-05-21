import { AuthShell } from '../_components/auth-shell.client';
import { LoginFormShell } from './_components/login-form-shell.client';

export const metadata = {
  title: 'Connexion — TAP Régulation',
};

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AuthShell title="Connexion">
      <LoginFormShell next={searchParams.next} />
    </AuthShell>
  );
}
