// src/app/(dashboard)/(admin-sections)/account-security/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  Paper,
  TextInput,
  Button,
  Badge,
  ActionIcon,
  Group,
  Title,
  Text,
  Modal,
  Stack,
  Loader,
  Center,
  Container,
  Box,
  ScrollArea,
  Select,
  Alert,
} from "@mantine/core";
import {
  IconShieldLock,
  IconSearch,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconExclamationCircle,
  IconInfoCircle,
  IconAlertTriangle,
  IconEye,
  IconMail,
} from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "react-hot-toast";

interface UnlockRequest {
  email: string;
  reason: string;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'needs_more_info';
  adminNotes?: string;
}

interface LockedAccount {
  id: string;
  userId: string;
  failedLoginCount: number;
  accountLocked: boolean;
  lockedAt?: Date;
  lockedBy?: string;
  lockedReason?: string;
  lastLoginAttempt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // User details (to be populated)
  userEmail?: string;
  userName?: string;
  // Unlock request from homeowner
  unlockRequest?: UnlockRequest;
}

interface PaginationData {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const AccountSecuritySection = () => {
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<LockedAccount | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [collectionExists, setCollectionExists] = useState(true);
  const [showViewModal, setShowViewModal] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [sortBy, setSortBy] = useState("lockedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [securityStats, setSecurityStats] = useState({
    totalLockedAccounts: 0,
    failedAttemptsToday: 0,
  });

  useEffect(() => {
    fetchLockedAccounts();
    fetchSecurityStats();
  }, [pagination.page, searchTerm, sortBy, sortOrder]);

  const fetchLockedAccounts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/admin/locked-accounts?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 500) {
          // Collection might not exist
          setCollectionExists(false);
          setLockedAccounts([]);
          setPagination({
            page: 1,
            limit: 10,
            totalCount: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          });
          return;
        }
        throw new Error("Failed to fetch locked accounts");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch locked accounts");
      }

      setCollectionExists(true);
      setLockedAccounts(data.data.accounts || []);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error("Error fetching locked accounts:", error);
      toast.error("Failed to fetch locked accounts. Please try again.");
      setLockedAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityStats = async () => {
    try {
      const response = await fetch('/api/admin/locked-accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSecurityStats(data.data);
        }
      }
    } catch (error) {
      console.warn('Could not fetch security stats:', error);
      // Keep default values on error
    }
  };

  const runMigration = async () => {
    try {
      setMigrationLoading(true);

      const response = await fetch("/api/admin/migrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          migrationType: "create-user-security",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Migration failed");
      }

      toast.success("Migration completed successfully!");
      setShowMigrationModal(false);
      
      // Refresh the data
      await fetchLockedAccounts();
    } catch (error) {
      console.error("Migration error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Migration failed. Please try again."
      );
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleUnlockAccount = async () => {
    if (!selectedAccount || !unlockReason.trim()) {
      toast.error("Please provide a reason for unlocking the account");
      return;
    }

    try {
      setUnlocking(true);

      // Check if userId is invalid (contains @ or :)
      const userIdIsInvalid = 
        !selectedAccount.userId || 
        selectedAccount.userId.trim() === "" ||
        selectedAccount.userId.includes('@') ||
        selectedAccount.userId.includes(':');

      let response;
      
      if (userIdIsInvalid && selectedAccount.userEmail) {
        // Use email-based unlock if userId is invalid but we have an email
        console.log("Using email-based unlock for:", selectedAccount.userEmail);
        response = await fetch(
          `/api/admin/unlock-account-by-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: selectedAccount.userEmail,
              reason: unlockReason.trim(),
            }),
          }
        );
      } else if (userIdIsInvalid && selectedAccount.userId?.includes('@')) {
        // Extract email from userId if it contains an email
        const email = selectedAccount.userId.replace('email:', '').trim();
        console.log("Extracted email from userId:", email);
        response = await fetch(
          `/api/admin/unlock-account-by-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              reason: unlockReason.trim(),
            }),
          }
        );
      } else if (userIdIsInvalid) {
        // No way to identify the user
        toast.error("Cannot unlock: User ID is invalid and no email found. Please use Fix Broken Records first.");
        setUnlocking(false);
        return;
      } else {
        // Use normal userId-based unlock
        response = await fetch(
        `/api/admin/unlock-account/${encodeURIComponent(selectedAccount.userId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: unlockReason.trim(),
          }),
        }
      );
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to unlock account");
      }

      if (data.data?.userIdWasFixed) {
        toast.success("Account unlocked and userId was automatically corrected!");
      } else {
      toast.success("Account unlocked successfully!");
      }
      
      setShowUnlockModal(false);
      setSelectedAccount(null);
      setUnlockReason("");
      
      // Refresh the list and stats
      await fetchLockedAccounts();
      await fetchSecurityStats();
    } catch (error) {
      console.error("Error unlocking account:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to unlock account. Please try again."
      );
    } finally {
      setUnlocking(false);
    }
  };

  const openUnlockModal = (account: LockedAccount) => {
    setSelectedAccount(account);
    // If homeowner submitted a request, use their reason
    if (account.unlockRequest?.reason) {
      setUnlockReason(account.unlockRequest.reason);
    } else {
      setUnlockReason("");
    }
    setShowUnlockModal(true);
  };

  const openViewModal = (account: LockedAccount) => {
    setSelectedAccount(account);
    setShowViewModal(true);
  };

  const handleResendEmail = async () => {
    if (!selectedAccount?.userEmail) {
      toast.error("No email address found for this account");
      return;
    }

    setResendingEmail(true);
    try {
      const response = await fetch("/api/admin/resend-unlock-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: selectedAccount.userEmail,
          userName: selectedAccount.userName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to resend email");
      }

      toast.success("Email sent successfully! User can resubmit their reason.");
      setShowViewModal(false);
      await fetchLockedAccounts();
    } catch (error) {
      console.error("Resend email error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to resend email. Please try again."
      );
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const getStatusBadge = (account: LockedAccount) => {
    return (
      <Badge color="red" variant="filled">
        <Group gap={4}>
          <IconLock size={12} />
          Locked
        </Group>
      </Badge>
    );
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const getAttemptsColor = (count: number) => {
    if (count >= 3) return "red";
    if (count >= 2) return "orange";
    return "yellow";
  };

  if (loading && lockedAccounts.length === 0) {
    return (
      <Container size="xl" py="xl">
        <Center style={{ height: 400 }}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group mb="xl" justify="space-between">
        <Group>
          <IconShieldLock size={32} color="red" />
          <Box>
            <Title order={1}>Account Security</Title>
            <Text c="dimmed">Manage locked accounts and failed login attempts</Text>
          </Box>
        </Group>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              fetchLockedAccounts();
              fetchSecurityStats();
            }}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* Info Alert */}
      <Alert
        icon={<IconInfoCircle size={16} />}
        title="Security Information"
        color="blue"
        variant="light"
        mb="md"
      >
        <Text size="sm">
          Accounts are automatically locked after 3 failed login attempts. 
          Users must contact admin or customer service to regain access.
        </Text>
      </Alert>

      {/* Statistics */}
      <Group mb="md">
        <Paper p="md" style={{ flex: 1 }}>
          <Group>
            <IconLock size={24} color="red" />
            <Box>
              <Text size="sm" c="dimmed">
                Total Locked Accounts
              </Text>
              <Text size="xl" fw={700}>
                {securityStats.totalLockedAccounts}
              </Text>
            </Box>
          </Group>
        </Paper>
        <Paper p="md" style={{ flex: 1 }}>
          <Group>
            <IconExclamationCircle size={24} color="orange" />
            <Box>
              <Text size="sm" c="dimmed">
                Failed Attempts Today
              </Text>
              <Text size="xl" fw={700}>
                {securityStats.failedAttemptsToday}
              </Text>
            </Box>
          </Group>
        </Paper>
      </Group>

      {/* Search and Filters */}
      <Paper p="md" mb="md" shadow="sm">
        <Group justify="space-between">
          <TextInput
            placeholder="Search by name or reason..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ maxWidth: 400 }}
          />
          <Group>
            <Select
              label="Sort by"
              value={sortBy}
              onChange={(value) => setSortBy(value || "lockedAt")}
              data={[
                { value: "lockedAt", label: "Locked Date" },
                { value: "failedLoginCount", label: "Failed Attempts" },
                { value: "lastLoginAttempt", label: "Last Attempt" },
              ]}
              style={{ width: 150 }}
              size="xs"
            />
            <Select
              label="Order"
              value={sortOrder}
              onChange={(value) => setSortOrder(value || "desc")}
              data={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
              style={{ width: 120 }}
              size="xs"
            />
          </Group>
        </Group>
      </Paper>

      {/* Table */}
      <Paper shadow="sm">
        <ScrollArea type="auto">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Locked Date</Table.Th>
                <Table.Th>Last Attempt</Table.Th>
                <Table.Th>Locked Reason</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lockedAccounts.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {account.userName || <Text c="dimmed" span>Unknown</Text>}
                    </Text>
                    {account.userEmail && (
                      <Text size="xs" c="dimmed">
                        {account.userEmail}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDate(account.lockedAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDate(account.lastLoginAttempt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ maxWidth: 200 }}>
                      {account.lockedReason || "N/A"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {account.unlockRequest && (
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => openViewModal(account)}
                          title="View Unlock Request"
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        variant="light"
                        color="green"
                        onClick={() => openUnlockModal(account)}
                        title="Unlock Account"
                        disabled={!account.userId && !account.userEmail}
                      >
                        <IconLockOpen size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {lockedAccounts.length === 0 && !loading && (
          <Center py="xl">
            <Stack align="center">
              <IconShieldLock size={48} color="gray" />
              <Title order={3} c="dimmed">
                No locked accounts found
              </Title>
              <Text c="dimmed">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "All accounts are currently secure."}
              </Text>
            </Stack>
          </Center>
        )}
      </Paper>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Button
            variant="default"
            disabled={!pagination.hasPrev}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <Text size="sm" c="dimmed">
            Page {pagination.page} of {pagination.totalPages}
          </Text>
          <Button
            variant="default"
            disabled={!pagination.hasNext}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </Group>
      )}

      {/* Migration Required Modal */}
      {!collectionExists && (
        <Modal
          opened={!collectionExists}
          onClose={() => {}}
          title={
            <Group>
              <IconAlertTriangle size={20} color="orange" />
              <Text>Setup Required</Text>
            </Group>
          }
          size="md"
          closeOnClickOutside={false}
          closeOnEscape={false}
        >
          <Stack>
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="blue"
              variant="light"
            >
              <Text size="sm">
                The UserSecurity collection needs to be created to enable failed 
                login tracking and account security features.
              </Text>
            </Alert>

            <Text size="sm">
              This will create the necessary database structure for:
            </Text>
            <Stack gap="xs" pl="md">
              <Text size="sm">• Failed login attempt tracking</Text>
              <Text size="sm">• Account lockout management</Text>
              <Text size="sm">• Admin unlock capabilities</Text>
              <Text size="sm">• Security audit logging</Text>
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button
                color="blue"
                onClick={() => setShowMigrationModal(true)}
                leftSection={<IconShieldLock size={16} />}
              >
                Create UserSecurity Collection
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Migration Confirmation Modal */}
      <Modal
        opened={showMigrationModal}
        onClose={() => {
          setShowMigrationModal(false);
        }}
        title={
          <Group>
            <IconShieldLock size={20} color="blue" />
            <Text>Run Migration</Text>
          </Group>
        }
        size="md"
      >
        <Stack>
          <Text size="sm">
            This will create the UserSecurity collection and set up the necessary 
            database indexes for failed login tracking.
          </Text>

          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="orange"
            variant="light"
          >
            <Text size="sm">
              Please ensure you have proper database backups before running migrations.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setShowMigrationModal(false)}
            >
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={runMigration}
              loading={migrationLoading}
              leftSection={<IconShieldLock size={16} />}
            >
              Run Migration
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Unlock Account Modal */}
      <Modal
        opened={showUnlockModal}
        onClose={() => {
          setShowUnlockModal(false);
          setSelectedAccount(null);
          setUnlockReason("");
        }}
        title={
          <Group>
            <IconLockOpen size={20} color="green" />
            <Text>Unlock Account</Text>
          </Group>
        }
        size="md"
      >
        <Stack>
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="orange"
            variant="light"
          >
            <Text size="sm">
              You are about to unlock an account that was locked due to security 
              concerns. Please verify with the user before proceeding.
            </Text>
          </Alert>

          {selectedAccount && (
            <Paper p="lg" withBorder style={{ backgroundColor: "#f8f9fa" }}>
              <Stack gap="md">
                <Box>
                  <Text size="xs" c="dimmed" fw={500} mb={4}>
                    Name
                  </Text>
                  <Text size="sm" fw={500} c="dark" style={{ wordBreak: 'break-all' }}>
                    {selectedAccount.userName || "Unknown"}
                  </Text>
                  {selectedAccount.userEmail && (
                    <Text size="xs" c="blue.6" mt={4}>
                      {selectedAccount.userEmail}
                    </Text>
                  )}
                </Box>

                <Box>
                  <Text size="xs" c="dimmed" fw={500} mb={4}>
                    Locked Date
                  </Text>
                  <Text size="sm" fw={500} c="dark">
                    {formatDate(selectedAccount.lockedAt)}
                  </Text>
                </Box>

                <Box>
                  <Text size="xs" c="dimmed" fw={500} mb={4}>
                    Locked Reason
                  </Text>
                  <Text size="sm" fw={500} c="dark">
                    {selectedAccount.lockedReason || "N/A"}
                  </Text>
                </Box>
              </Stack>
            </Paper>
          )}

          {selectedAccount?.unlockRequest?.reason ? (
            <Box>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                Homeowner's Submitted Reason
              </Text>
              <Paper p="sm" withBorder style={{ backgroundColor: "#e7f5ff" }}>
                <Text size="sm" c="dark">
                  {selectedAccount.unlockRequest.reason}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Submitted: {formatDate(selectedAccount.unlockRequest.submittedAt)}
                </Text>
              </Paper>
            </Box>
          ) : (
            <TextInput
              label="Reason to Unlock"
              placeholder="Enter reason for unlocking this account..."
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.currentTarget.value)}
              required
            />
          )}

          <Text size="xs" c="dimmed">
            This action will reset the failed login count to 0 and allow the user 
            to attempt logging in again.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setShowUnlockModal(false);
                setSelectedAccount(null);
                setUnlockReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              color="green"
              onClick={handleUnlockAccount}
              loading={unlocking}
              leftSection={<IconLockOpen size={16} />}
            >
              Unlock Account
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Unlock Request Modal */}
      <Modal
        opened={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedAccount(null);
        }}
        title={
          <Group>
            <IconEye size={20} color="blue" />
            <Text>View Unlock Request</Text>
          </Group>
        }
        size="md"
      >
        <Stack>
          {selectedAccount && (
            <>
              <Paper p="lg" withBorder style={{ backgroundColor: "#f8f9fa" }}>
                <Stack gap="md">
                  <Box>
                    <Text size="xs" c="dimmed" fw={500} mb={4}>
                      Name
                    </Text>
                    <Text size="sm" fw={500} c="dark">
                      {selectedAccount.userName || "Unknown"}
                    </Text>
                    {selectedAccount.userEmail && (
                      <Text size="xs" c="blue.6" mt={4}>
                        {selectedAccount.userEmail}
                      </Text>
                    )}
                  </Box>

                  <Box>
                    <Text size="xs" c="dimmed" fw={500} mb={4}>
                      Locked Date
                    </Text>
                    <Text size="sm" fw={500} c="dark">
                      {formatDate(selectedAccount.lockedAt)}
                    </Text>
                  </Box>
                </Stack>
              </Paper>

              {selectedAccount.unlockRequest && (
                <Box>
                  <Text size="sm" fw={600} mb={8}>
                    Homeowner&apos;s Unlock Request
                  </Text>
                  <Paper p="md" withBorder style={{ backgroundColor: "#e7f5ff" }}>
                    <Text size="sm" c="dark" style={{ whiteSpace: "pre-wrap" }}>
                      {selectedAccount.unlockRequest.reason}
                    </Text>
                    <Text size="xs" c="dimmed" mt={8}>
                      Submitted: {formatDate(selectedAccount.unlockRequest.submittedAt)}
                    </Text>
                    <Badge 
                      size="sm" 
                      color={
                        selectedAccount.unlockRequest.status === 'pending' ? 'yellow' :
                        selectedAccount.unlockRequest.status === 'approved' ? 'green' :
                        selectedAccount.unlockRequest.status === 'needs_more_info' ? 'orange' : 'red'
                      }
                      mt={8}
                    >
                      {selectedAccount.unlockRequest.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </Paper>
                </Box>
              )}

              <Alert
                icon={<IconInfoCircle size={16} />}
                color="blue"
                variant="light"
              >
                <Text size="xs">
                  If the reason provided is not sufficient, you can request the homeowner to 
                  provide more details by clicking the button below.
                </Text>
              </Alert>

              <Group justify="space-between" mt="md">
                <Button
                  variant="light"
                  color="orange"
                  leftSection={<IconMail size={16} />}
                  onClick={handleResendEmail}
                  loading={resendingEmail}
                >
                  Request More Info
                </Button>
                <Group>
                  <Button
                    variant="default"
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedAccount(null);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    color="green"
                    leftSection={<IconLockOpen size={16} />}
                    onClick={() => {
                      setShowViewModal(false);
                      openUnlockModal(selectedAccount);
                    }}
                  >
                    Unlock Account
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Container>
  );
};

export default AccountSecuritySection;