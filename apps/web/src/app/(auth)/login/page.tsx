import { AuthShell } from '../_components/auth-shell';
import { LoginFormShell } from './_components/login-form-shell.client';

export const metadata = {
  title: 'Connexion',
};

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <AuthShell title="Connexion">
      <LoginFormShell next={searchParams.next} />
    </AuthShell>
  );
}
