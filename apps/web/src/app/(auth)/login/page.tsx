import { AuthShell } from '../_components/auth-shell';
import { LoginFormShell } from './_components/login-form-shell.client';

export const metadata = {
  title: 'Connexion',
};

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AuthShell title="Connexion">
      <LoginFormShell next={searchParams.next} />
    </AuthShell>
  );
}
