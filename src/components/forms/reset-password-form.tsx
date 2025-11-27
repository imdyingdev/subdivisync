"use client";

import type React from "react";
import {
  Button,
  TextInput,
  Paper,
  Title,
  Text,
  Stack,
  Progress,
  Box,
  useMantineColorScheme,
  useMantineTheme,
  Anchor,
  alpha,
} from "@mantine/core";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const titleColor = colorScheme === "dark" ? "white" : "dark";
  const paperBg = colorScheme === "dark" ? theme.colors.dark[6] : theme.white;
  const subTextColor = colorScheme === "dark" ? theme.colors.gray[1] : theme.colors.gray[7];
  const greenBgColor = alpha(theme.colors.green[6], 0.1);
  const greenBorderColor = alpha(theme.colors.green[6], 0.2);
  const errorBgColor = alpha(theme.colors.red[6], 0.1);

  // Check password strength
  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 20;
    if (pwd.length >= 10) strength += 10;
    if (pwd.length >= 12) strength += 10;
    if (pwd.match(/[a-z]/)) strength += 20;
    if (pwd.match(/[A-Z]/)) strength += 20;
    if (pwd.match(/[0-9]/)) strength += 20;
    if (pwd.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/)) strength += 20;
    return Math.min(strength, 100);
  };

  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(password));
  }, [password]);

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setError(
        "Invalid or missing reset token. Please request a new password reset link."
      );
    }
  }, [token]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/(?=.*[0-9])/.test(pwd)) {
      return "Password must contain at least one number";
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`])/.test(pwd)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setIsLoading(true);

    try {
      const { error: resetError } = await authClient.resetPassword({
        token: token,
        newPassword: password,
      });

      if (resetError) {
        // Handle specific error cases
        if (resetError.message?.includes("expired")) {
          setError(
            "Reset link has expired. Please request a new password reset."
          );
        } else if (resetError.message?.includes("invalid")) {
          setError("Invalid reset token. Please request a new password reset.");
        } else {
          setError(
            resetError.message || "Failed to reset password. Please try again."
          );
        }
      } else {
        // Success
        setIsSubmitted(true);

        // Redirect to login after successful reset
        setTimeout(() => {
          router.push("/login?message=password-reset-success");
        }, 3000);
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const getStrengthColor = (strength: number) => {
    if (strength < 25) return "red";
    if (strength < 50) return "orange";
    if (strength < 75) return "yellow";
    return "green";
  };

  const getStrengthText = (strength: number) => {
    if (strength < 25) return "Weak";
    if (strength < 50) return "Fair";
    if (strength < 75) return "Good";
    return "Strong";
  };

  if (isSubmitted) {
    return (
      <Paper
        className="w-full max-w-sm mx-auto"
        p="xl"
        radius="md"
        withBorder
        style={{
          backgroundColor: paperBg,
        }}
      >
        <div className="text-center mb-6">
          <Title order={2} className="text-xl mb-2" c={titleColor}>
            Password Reset Successful
          </Title>
          <Text size="sm" style={{ color: subTextColor }}>
            Your password has been successfully updated
          </Text>
        </div>

        <Stack gap="md">
          <div
            className="text-center p-4 rounded-md border"
            style={{
              backgroundColor: greenBgColor,
              borderColor: greenBorderColor,
            }}
          >
            <Text size="sm" c="green.7">
              You can now sign in with your new password. Redirecting to
              login in 3 seconds...
            </Text>
          </div>

          <Link href="/login">
            <Button variant="filled" size="md" fullWidth>
              Back to Sign In
            </Button>
          </Link>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      className="w-full max-w-sm mx-auto"
      p="xl"
      radius="md"
      withBorder
      style={{
        backgroundColor: paperBg,
      }}
    >
      <div className="text-center mb-6">
        <Title order={2} className="text-xl mb-2" c={titleColor}>
          Reset Your Password
        </Title>
        <Text size="sm" style={{ color: subTextColor }}>
          Enter your new password below
        </Text>
      </div>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <div 
              className="rounded" 
              style={{
                backgroundColor: errorBgColor,
                padding: '12px 16px',
                marginBottom: '8px',
                border: `1px solid ${alpha(theme.colors.red[6], 0.3)}`,
              }}
            >
              <Text
                size="sm"
                c="red"
                ta="center"
                fw={500}
              >
                {error}
              </Text>
            </div>
          )}

          <div>
            <TextInput
              label="New Password"
              placeholder="Enter your new password"
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              disabled={isLoading}
              styles={{
                label: {
                  color: colorScheme === "dark" ? "#ffffff" : "#374151",
                  fontWeight: 500,
                },
              }}
            />

            {password && (
              <Box mt="xs">
                <Text size="xs" c="dimmed" mb={4}>
                  Password strength: {getStrengthText(passwordStrength)}
                </Text>
                <Progress
                  value={passwordStrength}
                  color={getStrengthColor(passwordStrength)}
                  size="sm"
                  radius="sm"
                />
              </Box>
            )}
          </div>

          <TextInput
            label="Confirm New Password"
            placeholder="Confirm your new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => handleConfirmPasswordChange(e.target.value)}
            required
            disabled={isLoading}
            styles={{
              label: {
                color: colorScheme === "dark" ? "#ffffff" : "#374151",
                fontWeight: 500,
              },
            }}
            error={
              confirmPassword && password !== confirmPassword
                ? "Passwords do not match"
                : null
            }
          />

          <div
            className="p-2 rounded"
            style={{
              backgroundColor: colorScheme === "dark" ? alpha(theme.colors.gray[6], 0.2) : alpha(theme.colors.gray[0], 0.5),
              color: subTextColor,
              fontSize: '10px',
            }}
          >
            <Text size="xs" style={{ color: subTextColor, fontSize: '11px', fontWeight: 500 }}>
              Password requirements:
            </Text>
            <ul className="mt-1 space-y-1" style={{ fontSize: '10px' }}>
              <li
                style={{
                  color: password.length >= 8
                    ? theme.colors.green[6]
                    : subTextColor,
                }}
              >
                • Use at least 8–12 characters
              </li>
              <li
                style={{
                  color: /[A-Z]/.test(password)
                    ? theme.colors.green[6]
                    : subTextColor,
                }}
              >
                • Include at least one Uppercase Letter (A–Z)
              </li>
              <li
                style={{
                  color: /[a-z]/.test(password)
                    ? theme.colors.green[6]
                    : subTextColor,
                }}
              >
                • Include at least one Lowercase Letter (a–z)
              </li>
              <li
                style={{
                  color: /[0-9]/.test(password)
                    ? theme.colors.green[6]
                    : subTextColor,
                }}
              >
                • Include at least one Number (0–9)
              </li>
              <li
                style={{
                  color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
                    ? theme.colors.green[6]
                    : subTextColor,
                }}
              >
                • Include at least one Special Character (! @ # $ % ^ & )
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            color="blue"
            size="md"
            fullWidth
            loading={isLoading}
            disabled={
              isLoading ||
              !password ||
              !confirmPassword ||
              password !== confirmPassword ||
              passwordStrength < 50 ||
              !token
            }
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>

          <Text ta="center" size="sm" style={{ color: subTextColor }}>
            Remember your password?{" "}
            <Anchor
              component={Link}
              href="/login"
              c="blue"
              underline="hover"
              fw={500}
            >
              Back to Sign In
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
