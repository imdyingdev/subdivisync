"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Paper,
  Title,
  Text,
  TextInput,
  Textarea,
  Button,
  Stack,
  Alert,
  Center,
  Loader,
  useMantineTheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconLock, IconCheck, IconAlertCircle, IconMail } from "@tabler/icons-react";
import Link from "next/link";

function UnlockRequestContent() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromUrl);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [accountStatus, setAccountStatus] = useState<{
    accountLocked: boolean;
    hasUnlockRequest: boolean;
    unlockRequestStatus?: string;
  } | null>(null);

  const paperBg = colorScheme === "dark" ? theme.colors.dark[6] : theme.white;
  const subTextColor = colorScheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6];

  // Check account status on load
  useEffect(() => {
    const checkStatus = async () => {
      if (!emailFromUrl) {
        setCheckingStatus(false);
        return;
      }

      try {
        const response = await fetch(`/api/unlock-request?email=${encodeURIComponent(emailFromUrl)}`);
        const data = await response.json();
        
        if (data.success) {
          setAccountStatus(data);
          if (data.hasUnlockRequest && data.unlockRequestStatus === 'pending') {
            setSubmitted(true);
          }
        }
      } catch (err) {
        console.error("Failed to check status:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [emailFromUrl]);

  const wordCount = reason.trim().split(/\s+/).filter(Boolean).length;
  const isReasonValid = wordCount >= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!isReasonValid) {
      setError("Please provide a reason with at least 20 words");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/unlock-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Failed to submit unlock request");
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <Center style={{ minHeight: "50vh" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (submitted) {
    return (
      <Paper
        className="w-full max-w-md mx-auto"
        p="xl"
        radius="md"
        withBorder
        style={{ backgroundColor: paperBg }}
      >
        <div className="text-center mb-6">
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              backgroundColor: theme.colors.green[0],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <IconCheck size={32} color={theme.colors.green[6]} />
          </div>
          <Title order={2} className="text-xl mb-2" c={colorScheme === "dark" ? "white" : "dark"}>
            Request Submitted
          </Title>
          <Text size="sm" style={{ color: subTextColor }}>
            Your unlock request has been submitted successfully
          </Text>
        </div>

        <Alert
          icon={<IconMail size={16} />}
          color="blue"
          variant="light"
          className="mb-4"
        >
          <Text size="sm">
            An administrator will review your request and unlock your account if approved.
            You will be notified once a decision is made.
          </Text>
        </Alert>

        <Link href="/login">
          <Button variant="filled" fullWidth>
            Back to Login
          </Button>
        </Link>
      </Paper>
    );
  }

  if (accountStatus && !accountStatus.accountLocked) {
    return (
      <Paper
        className="w-full max-w-md mx-auto"
        p="xl"
        radius="md"
        withBorder
        style={{ backgroundColor: paperBg }}
      >
        <div className="text-center mb-6">
          <IconCheck size={48} color={theme.colors.green[6]} style={{ margin: "0 auto 16px" }} />
          <Title order={2} className="text-xl mb-2" c={colorScheme === "dark" ? "white" : "dark"}>
            Account Not Locked
          </Title>
          <Text size="sm" style={{ color: subTextColor }}>
            This account is not currently locked. You can proceed to login.
          </Text>
        </div>

        <Link href="/login">
          <Button variant="filled" fullWidth>
            Go to Login
          </Button>
        </Link>
      </Paper>
    );
  }

  return (
    <Paper
      className="w-full max-w-md mx-auto"
      p="xl"
      radius="md"
      withBorder
      style={{ backgroundColor: paperBg }}
    >
      <div className="text-center mb-6">
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            backgroundColor: theme.colors.red[0],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <IconLock size={32} color={theme.colors.red[6]} />
        </div>
        <Title order={2} className="text-xl mb-2" c={colorScheme === "dark" ? "white" : "dark"}>
          Request Account Unlock
        </Title>
        <Text size="sm" style={{ color: subTextColor }}>
          Submit a reason for unlocking your account
        </Text>
      </div>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            label="Email Address"
            placeholder="Enter your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || !!emailFromUrl}
            styles={{
              label: {
                color: colorScheme === "dark" ? "#ffffff" : "#374151",
                fontWeight: 500,
              },
            }}
          />

          <div>
            <Textarea
              label="Reason for Unlock Request"
              placeholder="Please explain why your account should be unlocked. Provide details about why you couldn't log in successfully..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minRows={4}
              maxRows={6}
              disabled={loading}
              styles={{
                label: {
                  color: colorScheme === "dark" ? "#ffffff" : "#374151",
                  fontWeight: 500,
                },
              }}
            />
            <Text
              size="xs"
              c={isReasonValid ? "green" : "dimmed"}
              mt={4}
            >
              {wordCount}/20 words minimum {isReasonValid && "✓"}
            </Text>
          </div>

          <Alert
            icon={<IconAlertCircle size={16} />}
            color="blue"
            variant="light"
          >
            <Text size="xs">
              Your request will be reviewed by an administrator. Please provide a clear and 
              honest explanation to help expedite the review process.
            </Text>
          </Alert>

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={loading || !email.trim() || !isReasonValid}
          >
            Submit Unlock Request
          </Button>

          <Text ta="center" size="sm" style={{ color: subTextColor }}>
            <Link
              href="/login"
              style={{
                color: colorScheme === "dark" ? theme.colors.blue[4] : theme.colors.blue[6],
                textDecoration: "none",
              }}
            >
              Back to Login
            </Link>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}

export default function UnlockRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={
        <Center style={{ minHeight: "50vh" }}>
          <Loader size="lg" />
        </Center>
      }>
        <UnlockRequestContent />
      </Suspense>
    </div>
  );
}
