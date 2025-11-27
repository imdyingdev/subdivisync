
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  TextInput,
  Paper,
  Title,
  Text,
  Stack,
  Checkbox,
  useMantineTheme,
  useMantineColorScheme,
  Alert,
} from "@mantine/core";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { getServerSession } from "@/better-auth/action";
import { Session } from "@/better-auth/auth-types";
import { toast } from "react-hot-toast";
import { IconAlertCircle, IconClock } from "@tabler/icons-react";

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function LoginForm() {
  const router = useRouter();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [accountLocked, setAccountLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [failedLoginCount, setFailedLoginCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const session = await getServerSession();
      setSession(session);
    };
    fetchSession();

    if (session?.session.token) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  // Function to get user's IP address
  const getUserIP = async (): Promise<string | undefined> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Could not fetch user IP:', error);
      return undefined;
    }
  };

  // Function to get account status
  const getAccountStatus = async (email: string) => {
    try {
      const response = await fetch(`/api/auth/failed-login?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      if (data.success) {
        setAccountLocked(data.accountLocked || false);
        setFailedLoginCount(data.failedLoginCount || 0);
        setAttemptsRemaining(data.attemptsRemaining ?? null);
        setIsNewUser(data.isNewUser || false);
      }
    } catch (error) {
      console.warn('Could not fetch account status:', error);
    }
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Check account status when email is entered
    if (field === "email" && typeof value === "string" && value.trim()) {
      getAccountStatus(value.trim());
    }
  };

  const handleEmailFocus = () => {
    if (formData.email.trim()) {
      getAccountStatus(formData.email.trim());
    }
  };

  const validateForm = (): string | null => {
    if (!formData.email.trim()) return "Email is required";
    if (!formData.password) return "Password is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email))
      return "Please enter a valid email address";

    return null;
  };

  // Track failed login attempt
  const trackFailedLogin = async (userId: string | null, email: string) => {
    try {
      const ipAddress = await getUserIP();
      
      const response = await fetch('/api/auth/failed-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId || undefined,
          email,
          ipAddress,
        }),
      });

      const data = await response.json();
      
      // Always update UI state, regardless of response status
      // The API will tell us the current state
      setAccountLocked(data.accountLocked || false);
      setFailedLoginCount(data.failedLoginCount || 0);
      setAttemptsRemaining(data.attemptsRemaining ?? null);
      setIsNewUser(false); // Once they've attempted login, they're not a "new user" anymore

      return data;
    } catch (error) {
      console.warn('Failed to track login attempt:', error);
      return null;
    }
  };

  // Reset failed login count on successful login
  const resetFailedLoginCount = async (email: string) => {
    try {
      const response = await fetch('/api/auth/reset-failed-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      });

      if (response.ok) {
        console.log('Failed login count reset successfully');
      }

      // Clear local state
      setAccountLocked(false);
      setFailedLoginCount(0);
      setAttemptsRemaining(null);
      setUserId(null);
      setIsNewUser(false);
    } catch (error) {
      console.warn('Failed to reset login count:', error);
      // Still clear local state even if API call fails
      setAccountLocked(false);
      setFailedLoginCount(0);
      setAttemptsRemaining(null);
      setUserId(null);
      setIsNewUser(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (accountLocked) {
      toast.error(
        "This account has been locked. Please contact admin or customer service to regain access."
      );
      return;
    }

    setIsLoading(true);

    try {
      // Check account status before attempting login
      const statusResponse = await fetch(`/api/auth/failed-login?email=${encodeURIComponent(formData.email)}`);
      const statusData = await statusResponse.json();
      
      // Check if account is locked from the API response
      if (statusData?.success) {
        // Update local state
        setAccountLocked(statusData.accountLocked || false);
        setFailedLoginCount(statusData.failedLoginCount || 0);
        setAttemptsRemaining(statusData.attemptsRemaining ?? null);
        setIsNewUser(statusData.isNewUser || false);
      }

      if (statusData.accountLocked) {
        toast.error(
          "This account has been locked. Please contact admin or customer service to regain access."
        );
        setIsLoading(false);
        return;
      }

      await authClient.signIn.email(
        {
          email: formData.email,
          password: formData.password,
          callbackURL: "/dashboard",
        },
        {
          async onSuccess(context) {
            // Reset failed login count in database on successful login
            await resetFailedLoginCount(formData.email);
            
            if (context.data.twoFactorRedirect) {
              await authClient.twoFactor.sendOtp();
              toast.success(
                "Two-factor authentication code sent to your email"
              );
              router.push("/2fa-verification");
            } else {
              toast.success("Successfully signed in!");
              router.push("/dashboard");
            }
          },
          async onError(context) {
            console.error("Sign in error:", context.error.message);
            
            // Check for email verification required
            if (context.error.status === 403) {
              toast.error("Please verify your email address");
              await authClient.sendVerificationEmail({
                email: formData.email,
                callbackURL: "/login",
              });
              toast.success("Verification email sent!");
              setIsLoading(false);
              return;
            }

            // For authentication errors, track failed login attempt first
            const failedLoginData = await trackFailedLogin(null, formData.email);
            
            // Update UI state with the latest information from tracking
            if (failedLoginData) {
              setAccountLocked(failedLoginData.accountLocked || false);
              setFailedLoginCount(failedLoginData.failedLoginCount || 0);
              setAttemptsRemaining(failedLoginData.attemptsRemaining ?? null);
              setIsNewUser(false); // Once they've failed, they're not new anymore
            }

            // Show appropriate message based on current account status
            if (failedLoginData?.accountLocked) {
              toast.error(
                "This account has been locked. Please contact admin or customer service to regain access."
              );
            } else {
              const hasFailedHistory = (failedLoginData?.failedLoginCount ?? 0) > 0;
              const remaining = hasFailedHistory
                ? (failedLoginData?.attemptsRemaining ?? 0)
                : 0;

              if (remaining > 0) {
                toast.error(
                  `Invalid credentials. You have only ${remaining} attempt${remaining !== 1 ? "s" : ""} left to login.`
                );
              } else {
                toast.error("Invalid credentials.");
              }
            }
          },
        }
      );
    } catch (err) {
      console.error("Sign in error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = accountLocked;

  return (
    <Paper
      className="w-full max-w-sm mx-auto"
      p="xl"
      style={{
        backgroundColor:
          colorScheme === "dark" ? theme.colors.dark[6] : theme.white,
      }}
    >
      <div className="text-center mb-6">
        <Title
          order={2}
          className="text-xl mb-2"
          style={{
            color: colorScheme === "dark" ? theme.white : theme.colors.gray[9],
          }}
        >
          Login
        </Title>
        <Text
          size="sm"
          style={{
            color:
              colorScheme === "dark"
                ? theme.colors.gray[4]
                : theme.colors.gray[6],
          }}
        >
          Sign in to your account to continue
        </Text>
      </div>

      {/* Lockout Alert */}
      {isLocked && (
        <Alert
          icon={<IconClock size={20} />}
          title="Account Locked"
          color="red"
          className="mb-4"
          variant="light"
          styles={{
            message: {
              fontSize: "0.875rem",
            },
            root: {
              backgroundColor: '#fff5f5',
              borderColor: '#f03e3e',
              borderWidth: '2px',
            },
          }}
        >
          <Text size="sm" fw={600} c="red.9" className="mb-2">
            This account has been locked
          </Text>
          <Text size="xs" c="dark.7" className="mb-2">
            Your account has been locked for security reasons. An email has been sent 
            to your registered email address with instructions to request an unlock.
          </Text>
          <Text size="xs" c="red.7" fw={600} className="mb-2">
            Failed attempts: {failedLoginCount}/3
          </Text>
          <Link
            href={`/unlock-request?email=${encodeURIComponent(formData.email)}`}
            style={{
              color: '#2563eb',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'underline',
            }}
          >
            Request Account Unlock →
          </Link>
        </Alert>
      )}

      {/* Attempts Warning */}
      {!isLocked && attemptsRemaining !== null && attemptsRemaining > 0 && attemptsRemaining <= 3 && (
        <Alert
          icon={<IconAlertCircle size={20} />}
          title="Warning"
          color="orange"
          className="mb-4"
        >
          <Text size="sm">
            {attemptsRemaining === 1
              ? "This is your last attempt before your account gets locked. You will need to contact admin to regain access."
              : `You have ${attemptsRemaining} attempt${
                  attemptsRemaining > 1 ? "s" : ""
                } remaining before your account gets locked.`}
          </Text>
        </Alert>
      )}

      <form onSubmit={handleEmailSignIn}>
        <Stack gap="md">
          <TextInput
            label="Email"
            placeholder="Enter your email"
            type="email"
            required
            value={formData.email}
            onFocus={handleEmailFocus}
            onChange={(e) => handleInputChange("email", e.target.value)}
            styles={{
              label: {
                color:
                  colorScheme === "dark" ? theme.white : theme.colors.gray[9],
                fontWeight: 500,
              },
            }}
            disabled={isLoading || !!isLocked}
          />

          <TextInput
            label="Password"
            placeholder="Enter your password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            styles={{
              label: {
                color:
                  colorScheme === "dark" ? theme.white : theme.colors.gray[9],
                fontWeight: 500,
              },
            }}
            disabled={isLoading || !!isLocked}
          />

          <div className="flex items-center justify-between gap-2">
            <Checkbox
              label="Remember me"
              size="sm"
              checked={formData.rememberMe}
              onChange={(e) =>
                handleInputChange("rememberMe", e.target.checked)
              }
              disabled={isLoading || !!isLocked}
              styles={{
                label: {
                  color:
                    colorScheme === "dark"
                      ? theme.colors.gray[4]
                      : theme.colors.gray[6],
                  fontSize: "0.875rem",
                },
              }}
            />
            <Link
              href="/forgot-password"
              className="text-sm font-medium hover:underline"
              style={{
                color:
                  colorScheme === "dark"
                    ? theme.colors.blue[4]
                    : theme.colors.blue[6],
              }}
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            size="md"
            fullWidth
            loading={isLoading}
            disabled={isLoading || !!isLocked}
          >
            {isLocked ? "Account Locked" : "Sign In"}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
