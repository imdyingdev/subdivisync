"use client";
import type React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  AppShell,
  NavLink,
  Text,
  Group,
  ActionIcon,
  Stack,
  Avatar,
  Divider,
  Badge,
  Burger,
  Tooltip,
  Modal,
  Button,
  ScrollArea,
  useMantineColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  IconDashboard,
  IconUsers,
  IconChevronRight,
  IconLogout,
  IconChevronLeft,
  IconMenu2,
  IconCreditCard,
  IconSpeakerphone,
  IconClipboardList,
  IconBuildingStore,
  IconFileText,
  IconUser,
  IconTool,
  IconReceipt,
  IconToolsKitchen,
  IconSun,
  IconMoonStars,
  IconShieldLock,
} from "@tabler/icons-react";
import { signOut } from "@/lib/auth-client";
import type { Session } from "@/better-auth/auth-types";
import axios from "axios";

// Add these interfaces at the top of your sidebar component file

interface ServiceRequest {
  status: "pending" | "in-progress" | "completed" | "cancelled";
  id: string;
  category: string;
  description: string;
  priority: string;
  user_id: string;
  user_email: string;
  user_name: string;
  payment_status: string;
  created_at: Date;
  updated_at: Date;
}

interface PropertyInquiry {
  fullName: string;
  email: string;
  phone: string;
  reason: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
}

interface Property {
  _id: string;
  title: string;
  location: string;
  size: string;
  price: number;
  type: "single-attached" | "duplex" | "two-storey-house";
  status: "CREATED" | "UNDER_INQUIRY" | "APPROVED" | "REJECTED" | "LEASED";
  inquiries?: PropertyInquiry[];
}

interface DashboardSidebarProps {
  children: React.ReactNode;
  session: Session;
}
interface NotificationCounts {
  serviceRequests: number;
  applications: number;
  lockedAccounts: number; // For admin's locked accounts count
  // Add tenant-specific counts
  myServiceRequests: number; // For tenant's service requests with updates
  myApplications: number; // For tenant's applications with status changes
}
export function DashboardSidebar({ children, session }: DashboardSidebarProps) {
  const [opened, setOpened] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationCounts>({
    serviceRequests: 0,
    applications: 0,
    lockedAccounts: 0,
    myServiceRequests: 0,
    myApplications: 0,
  });
  const pathname = usePathname();
  const router = useRouter();

  // Dark mode toggle logic
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();

  // Get user role with fallback
  const getUserRole = (role: string | undefined): "admin" | "tenant" => {
    if (role === "admin" || role === "tenant") {
      return role;
    }
    return "tenant";
  };

  const userRole = getUserRole(session.user.role || "user");
  const userName = session.user.name || "User";
  const userEmail = session.user.email || "";
  const userImage = session.user.image;

  // Fetch notification counts
  const fetchNotifications = async () => {
    try {
      if (userRole === "admin") {
        // Admin notifications - only pending items
        const serviceResponse = await axios.get("/api/service-requests");
        const pendingServices = serviceResponse.data.success
          ? serviceResponse.data.serviceRequests.filter(
              (req: ServiceRequest) => req.status === "pending"
            ).length
          : 0;

        const propertiesResponse = await axios.get("/api/properties");
        let pendingApplications = 0;

        if (propertiesResponse.data.success) {
          propertiesResponse.data.properties.forEach((property: Property) => {
            if (property.inquiries && Array.isArray(property.inquiries)) {
              pendingApplications += property.inquiries.filter(
                (inquiry: PropertyInquiry) => inquiry.status === "pending"
              ).length;
            }
          });
        }

        // Fetch locked accounts count
        let lockedAccountsCount = 0;
        try {
          const lockedResponse = await axios.get('/api/admin/locked-accounts?limit=1');
          if (lockedResponse.data.success) {
            lockedAccountsCount = lockedResponse.data.data?.pagination?.totalCount || 0;
          }
        } catch (err) {
          console.warn('Could not fetch locked accounts count:', err);
        }

        setNotifications({
          serviceRequests: pendingServices,
          applications: pendingApplications,
          lockedAccounts: lockedAccountsCount,
          myServiceRequests: 0,
          myApplications: 0,
        });
      } else if (userRole === "tenant") {
        // Tenant notifications - only show pending items
        const serviceResponse = await axios.get("/api/service-requests");
        const pendingServiceRequests = serviceResponse.data.success
          ? serviceResponse.data.serviceRequests.filter(
              (req: ServiceRequest) =>
                req.user_email === userEmail && req.status === "pending" // Only pending items show notification
            ).length
          : 0;

        // Count pending applications only
        const propertiesResponse = await axios.get(
          "/api/properties?myInquiries=true"
        );
        let pendingApplications = 0;

        if (propertiesResponse.data.success) {
          propertiesResponse.data.properties.forEach((property: Property) => {
            if (property.inquiries && Array.isArray(property.inquiries)) {
              pendingApplications += property.inquiries.filter(
                (inquiry: PropertyInquiry) =>
                  inquiry.email === userEmail && inquiry.status === "pending" // Only pending applications
              ).length;
            }
          });
        }

        setNotifications({
          serviceRequests: 0,
          applications: 0,
          lockedAccounts: 0,
          myServiceRequests: pendingServiceRequests,
          myApplications: pendingApplications,
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Optional: Poll for updates every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [pathname, userRole]);

  const handleLogout = async () => {
    try {
      await signOut();
      setShowLogoutModal(false);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      setShowLogoutModal(false);
    }
  };

  // Admin navigation items with notification badges
  const adminNavItems = [
    {
      icon: IconDashboard,
      label: "Dashboard",
      href: "/dashboard",
      description: "Overview & Statistics",
      notificationCount: 0,
    },
    {
      icon: IconBuildingStore,
      label: "Property",
      href: "/property",
      description: "Manage Properties",
      notificationCount: 0,
    },
    {
      icon: IconClipboardList,
      label: "Applications",
      href: "/applications",
      description: "Tenant Applications",
      notificationCount: notifications.applications,
    },
    {
      icon: IconToolsKitchen,
      label: "Service",
      href: "/services",
      description: "Service Requests",
      notificationCount: notifications.serviceRequests,
    },
    {
      icon: IconUsers,
      label: "Homeowners",
      href: "/homeowners",
      description: "Manage Homeowners",
      notificationCount: 0,
    },
    {
      icon: IconShieldLock,
      label: "Account Security",
      href: "/account-security",
      description: "Locked Accounts",
      notificationCount: notifications.lockedAccounts,
    },
    {
      icon: IconSpeakerphone,
      label: "Announcements",
      href: "/announcements",
      description: "Post Updates",
      notificationCount: 0,
    },
    {
      icon: IconCreditCard,
      label: "Payments",
      href: "/payments",
      description: "Payment Management",
      notificationCount: 0,
    },
    {
      icon: IconUser,
      label: "Profile",
      href: "/admin-profile",
      description: "Admin Account",
      notificationCount: 0,
    },
    {
      icon: IconLogout,
      label: "Logout",
      href: "#",
      description: "Sign Out",
      notificationCount: 0,
      isLogout: true,
    },
  ];

  // Tenant navigation items
  const tenantNavItems = [
    {
      icon: IconDashboard,
      label: "Dashboard",
      href: "/homeowner-dashboard", // Keep this path
      description: "Home & Updates",
      notificationCount: 0,
    },
    {
      icon: IconBuildingStore,
      label: "Browse Property",
      href: "/browse-property",
      description: "Available Properties",
      notificationCount: 0,
    },
    {
      icon: IconFileText,
      label: "My Applications",
      href: "/my-applications",
      description: "Application Status",
      notificationCount: notifications.myApplications,
    },
    {
      icon: IconTool,
      label: "Service Requests",
      href: "/service-requests",
      description: "Maintenance Requests",
      notificationCount: notifications.myServiceRequests,
    },
    {
      icon: IconReceipt,
      label: "Transactions",
      href: "/transactions",
      description: "Payment History",
      notificationCount: 0,
    },
    {
      icon: IconUser,
      label: "Profile",
      href: "/homeowner-profile", // Keep this path
      description: "My Account",
      notificationCount: 0,
    },
    {
      icon: IconLogout,
      label: "Logout",
      href: "#",
      description: "Sign Out",
      notificationCount: 0,
      isLogout: true,
    },
  ];

  // Select navigation items based on user role
  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const userTitle = userRole === "admin" ? "ADMIN" : "Homeowner";

  return (
    <AppShell
      navbar={{
        width: collapsed ? 80 : 280,
        breakpoint: "lg",
        collapsed: { mobile: !opened },
      }}
      header={{ height: { base: 60, lg: 0 } }}
      padding="md"
    >
      <AppShell.Header p="md" hiddenFrom="lg">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              size="sm"
              color={colorScheme === "dark" ? "white" : "dark"}
            />
            <Text size="lg" fw={700} c="blue" visibleFrom="xs">
              SubdiviSync
            </Text>
          </Group>
          <Tooltip label="Toggle color scheme">
            <ActionIcon
              variant="subtle"
              onClick={() => toggleColorScheme()}
              size="lg"
              color={colorScheme === "dark" ? "yellow" : "dark"}
            >
              {colorScheme === "dark" ? (
                <IconSun size="1.2rem" stroke={1.5} />
              ) : (
                <IconMoonStars size="1.2rem" stroke={1.5} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p={collapsed ? "xs" : "md"}
        bg={colorScheme === "dark" ? "dark.8" : "white"}
        withBorder
        style={{ 
          height: "100vh",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppShell.Section style={{ flexShrink: 0 }}>
          <Group justify="space-between" mb="md">
            {!collapsed && (
              <div>
                <Text size="xl" fw={700} c="blue">
                  SubdiviSync
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={userRole === "admin" ? "red" : "green"}
                  mt="xs"
                >
                  {userRole === "admin" ? "ADMIN" : "HOMEOWNER"}
                </Badge>
              </div>
            )}
            <Group gap="xs" visibleFrom="lg">
              <Tooltip
                label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                position="right"
              >
                <ActionIcon
                  variant="subtle"
                  onClick={() => setCollapsed(!collapsed)}
                  color={colorScheme === "dark" ? "gray.4" : "gray.6"}
                >
                  {collapsed ? (
                    <IconMenu2 size="1.2rem" stroke={1.5} />
                  ) : (
                    <IconChevronLeft size="1.2rem" stroke={1.5} />
                  )}
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Toggle color scheme" position="right">
                <ActionIcon
                  variant="subtle"
                  onClick={() => toggleColorScheme()}
                  size="lg"
                  color={colorScheme === "dark" ? "yellow" : "dark"}
                >
                  {colorScheme === "dark" ? (
                    <IconSun size="1.2rem" stroke={1.5} />
                  ) : (
                    <IconMoonStars size="1.2rem" stroke={1.5} />
                  )}
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </AppShell.Section>

        <Divider mb="md" style={{ flexShrink: 0 }} />

        <AppShell.Section grow component={ScrollArea} type="auto" scrollbarSize={6} style={{ minHeight: 0, flex: 1 }}>
          <Stack gap="xs">
            {navItems.map((item) => (
              <Tooltip
                key={item.href}
                label={
                  collapsed
                    ? `${item.label} - ${item.description}`
                    : item.description
                }
                position="right"
                disabled={!collapsed}
                openDelay={300}
              >
                <NavLink
                  component={(item as any).isLogout ? "button" : Link}
                  href={(item as any).isLogout ? undefined : item.href}
                  active={pathname === item.href}
                  label={collapsed ? "" : item.label}
                  onClick={(e: any) => {
                    if ((item as any).isLogout) {
                      e.preventDefault();
                      setShowLogoutModal(true);
                      setOpened(false);
                    } else {
                      setOpened(false);
                    }
                  }}
                  leftSection={<item.icon size="1.2rem" stroke={1.5} />}
                  rightSection={
                    !collapsed && (
                      <Group gap={4}>
                        {item.notificationCount > 0 && (
                          <Badge
                            color="red"
                            variant="filled"
                            size="sm"
                            circle
                            style={{
                              minWidth: 20,
                              height: 20,
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {item.notificationCount}
                          </Badge>
                        )}
                        <IconChevronRight size="0.8rem" stroke={1.5} />
                      </Group>
                    )
                  }
                  variant="filled"
                  style={collapsed ? { justifyContent: "center" } : undefined}
                  styles={{
                    root: {
                      color: (item as any).isLogout
                        ? theme.colors.red[6]
                        : colorScheme === "dark"
                          ? theme.colors.gray[4]
                          : theme.colors.dark[9],
                      backgroundColor:
                        pathname === item.href
                          ? colorScheme === "dark"
                            ? theme.colors.dark[6]
                            : theme.colors.blue[0]
                          : "transparent",
                      "&:hover": {
                        backgroundColor: (item as any).isLogout
                          ? colorScheme === "dark"
                            ? theme.colors.red[9]
                            : theme.colors.red[0]
                          : colorScheme === "dark"
                            ? theme.colors.dark[5]
                            : theme.colors.gray[0],
                      },
                      position: "relative",
                    },
                  }}
                >
                  {collapsed && item.notificationCount > 0 && (
                    <Badge
                      color="red"
                      variant="filled"
                      size="xs"
                      circle
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        minWidth: 16,
                        height: 16,
                        padding: 0,
                        fontSize: 10,
                      }}
                    >
                      {item.notificationCount}
                    </Badge>
                  )}
                </NavLink>
              </Tooltip>
            ))}
          </Stack>
        </AppShell.Section>

        <Divider my="md" style={{ flexShrink: 0 }} visibleFrom="sm" />

        <AppShell.Section style={{ flexShrink: 0 }} visibleFrom="sm">
          <Group wrap="nowrap" gap="xs">
            <Avatar src={userImage} radius="xl" size="sm">
              {!userImage && userName.charAt(0).toUpperCase()}
            </Avatar>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text
                  size="sm"
                  fw={500}
                  truncate
                  c={colorScheme === "dark" ? "white" : "dark"}
                >
                  {userName}
                </Text>
                <Text c="dimmed" size="xs" truncate>
                  {userEmail || userTitle}
                </Text>
              </div>
            )}
            <Tooltip label="Logout" position="right">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => setShowLogoutModal(true)}
              >
                <IconLogout size="1rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg={colorScheme === "dark" ? "dark.7" : "gray.0"}>
        {children}
      </AppShell.Main>

      {/* Logout Confirmation Modal */}
      <Modal
        opened={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Confirm Logout"
        centered
        size="sm"
      >
        <Text size="sm" mb="lg" c={colorScheme === "dark" ? "gray.4" : "dark"}>
          Are you sure you want to logout? You will be redirected to the login
          page.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="outline" onClick={() => setShowLogoutModal(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleLogout}>
            Logout
          </Button>
        </Group>
      </Modal>
    </AppShell>
  );
}
