import type { Metadata } from "next";
import LoginPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Login",
  description: "Authenticate as organizer to manage sessions.",
};

interface LoginPageProps {
  searchParams?: {
    redirect?: string | string[];
    registered?: string | string[];
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const redirectParam =
    typeof searchParams?.redirect === "string" ? searchParams.redirect : null;
  const registeredParam =
    typeof searchParams?.registered === "string" ? searchParams.registered : null;

  return (
    <LoginPageClient
      redirectParam={redirectParam}
      registeredParam={registeredParam}
    />
  );
}
