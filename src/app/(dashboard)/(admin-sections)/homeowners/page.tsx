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
  Select,
  Loader,
  Center,
  Container,
  Box,
  PasswordInput,
  ScrollArea,
} from "@mantine/core";
import { IconEdit, IconUsers, IconSearch, IconEye, IconAlertCircle, IconCheck, IconX } from "@tabler/icons-react";
import { Alert } from "@mantine/core";
import { authClient } from "@/lib/auth-client";
import { toast } from "react-hot-toast";

interface Tenant {
  _id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: string;
  created_at: string;
  address?: string;
  gender?: string;
  age?: number;
  phoneNumber?: string;
  property?: {
    title: string;
    location: string;
    type: string;
    sqft?: number;
    bedrooms?: number;
    bathrooms?: number;
  };
}

interface UserWithData {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  status?: string;
  address?: string;
  gender?: string;
  age?: number;
  phoneNumber?: string;
  property?: {
    title: string;
    location: string;
    type: string;
    sqft?: number;
    bedrooms?: number;
    bathrooms?: number;
  };
}

const defaultForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  password: "",
  confirmPassword: "",
  status: "Active",
  address: "",
  gender: "",
  age: "",
  phoneNumber: "",
};

const TenantsSection = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editForm, setEditForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState<{
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    address?: string;
    gender?: string;
    age?: string;
    phoneNumber?: string;
  }>({});
  const [dataFetched, setDataFetched] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);

  const [autoGeneratePassword, setAutoGeneratePassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!dataFetched) {
      fetchTenants();
      setDataFetched(true);
    }
  }, [dataFetched]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (dataFetched) {
        fetchTenants();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, dataFetched]);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const { data: users, error } = await authClient.admin.listUsers({
        query: {
          filterField: "role",
          filterValue: "tenant",
          filterOperator: "eq",
          limit: 100,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to fetch users");
      }

      const mappedTenants = (users.users || []).map((user: UserWithData) => ({
        _id: user.id, // IMPORTANT: Use user.id (UUID), not the MongoDB _id
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        status: user.status || "Active",
        created_at: user.createdAt.toISOString(),
        address: user.address || "",
        gender: user.gender || "",
        age: user.age || 0,
        phoneNumber: user.phoneNumber || "",
        property: user.property,
      }));

      // Sort by created_at descending (newest first) - Fix 7B
      mappedTenants.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTenants(mappedTenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      toast.error("Failed to fetch tenants. Please try again.");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoGeneratePassword && !editingTenant) {
      const newPassword = generateRandomPassword();
      setGeneratedPassword(newPassword);
      setEditForm((prev) => ({
        ...prev,
        password: newPassword,
        confirmPassword: newPassword,
      }));
    } else if (!autoGeneratePassword) {
      setGeneratedPassword("");
      if (!editingTenant) {
        setEditForm((prev) => ({
          ...prev,
          password: "",
          confirmPassword: "",
        }));
      }
    }
  }, [autoGeneratePassword, editingTenant]);

  const generateRandomPassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specialChars = '!@#$%^&*(),.?":{}|<>';
    const allChars = uppercase + lowercase + numbers + specialChars;

    let password = "";

    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specialChars[Math.floor(Math.random() * specialChars.length)];

    // Fill the rest randomly (total length: 12 characters)
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  const handleEditTenant = (tenant: Tenant) => {
    const nameParts = (tenant.user_name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const middleName =
      nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

    setEditingTenant(tenant);
    setEditForm({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      email: tenant.user_email || "",
      password: "",
      confirmPassword: "",
      status: tenant.status || "Active",
      address: tenant.address || "",
      gender: tenant.gender || "",
      age: tenant.age?.toString() || "",
      phoneNumber: tenant.phoneNumber || "",
    });
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errors: typeof formErrors = {};
    let isValid = true;

    // First Name validation
    if (!editForm.first_name.trim()) {
      errors.first_name = "First name is required";
      isValid = false;
    } else if (editForm.first_name.trim().length < 2) {
      errors.first_name = "First name must be at least 2 characters";
      isValid = false;
    }

    // Last Name validation
    if (!editForm.last_name.trim()) {
      errors.last_name = "Last name is required";
      isValid = false;
    } else if (editForm.last_name.trim().length < 2) {
      errors.last_name = "Last name must be at least 2 characters";
      isValid = false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editForm.email.trim()) {
      errors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(editForm.email)) {
      errors.email = "Invalid email format";
      isValid = false;
    }

    if (!editingTenant) {
      // Password validation with special characters
      if (!editForm.password) {
        errors.password = "Password is required";
        isValid = false;
      } else {
        if (editForm.password.length < 8) {
          errors.password = "Password must be at least 8 characters long";
          isValid = false;
        } else if (!/[A-Z]/.test(editForm.password)) {
          errors.password =
            "Password must contain at least one uppercase letter";
          isValid = false;
        } else if (!/[a-z]/.test(editForm.password)) {
          errors.password =
            "Password must contain at least one lowercase letter";
          isValid = false;
        } else if (!/[0-9]/.test(editForm.password)) {
          errors.password = "Password must contain at least one number";
          isValid = false;
        } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(editForm.password)) {
          errors.password =
            'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)';
          isValid = false;
        }
      }

      if (!autoGeneratePassword) {
        if (!editForm.password) {
          errors.password = "Password is required";
          isValid = false;
        } else {
          if (editForm.password.length < 8) {
            errors.password = "Password must be at least 8 characters long";
            isValid = false;
          } else if (!/[A-Z]/.test(editForm.password)) {
            errors.password =
              "Password must contain at least one uppercase letter";
            isValid = false;
          } else if (!/[a-z]/.test(editForm.password)) {
            errors.password =
              "Password must contain at least one lowercase letter";
            isValid = false;
          } else if (!/[0-9]/.test(editForm.password)) {
            errors.password = "Password must contain at least one number";
            isValid = false;
          } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(editForm.password)) {
            errors.password =
              'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)';
            isValid = false;
          }
        }

        if (!editForm.confirmPassword) {
          errors.confirmPassword = "Confirm password is required";
          isValid = false;
        } else if (editForm.password !== editForm.confirmPassword) {
          errors.confirmPassword = "Passwords do not match";
          isValid = false;
        }
      }

      // Phone number validation - optional but must be valid format if provided
      if (editForm.phoneNumber.trim()) {
        const phoneRegex = /^(09|\+639)\d{9}$/;
        if (!phoneRegex.test(editForm.phoneNumber.trim())) {
          errors.phoneNumber =
            "Invalid phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX";
          isValid = false;
        }
      }

      if (!editForm.gender) {
        errors.gender = "Gender is required";
        isValid = false;
      }

      // Date of birth validation
      if (!editForm.age.trim()) {
        errors.age = "Date of birth is required";
        isValid = false;
      } else {
        const birthDate = new Date(editForm.age);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        // Adjust age if birthday hasn't occurred this year
        const actualAge =
          monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

        if (actualAge < 18) {
          errors.age = "Tenant must be at least 18 years old";
          isValid = false;
        } else if (actualAge > 120) {
          errors.age = "Please enter a valid date of birth";
          isValid = false;
        }
      }
    } else {
      // For existing tenants
      if (editForm.phoneNumber.trim().length > 0) {
        const phoneRegex = /^(09|\+639)\d{9}$/;
        if (!phoneRegex.test(editForm.phoneNumber.trim())) {
          errors.phoneNumber =
            "Invalid phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX";
          isValid = false;
        }
      }

      // Validate date of birth if provided for existing tenant
      if (editForm.age.trim() !== "") {
        const birthDate = new Date(editForm.age);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        const actualAge =
          monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

        if (actualAge < 18) {
          errors.age = "Tenant must be at least 18 years old";
          isValid = false;
        } else if (actualAge > 120) {
          errors.age = "Please enter a valid date of birth";
          isValid = false;
        }
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleCreateTenant = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      if (!editForm.password) {
        toast.error("Password is required for new tenants.");
        return;
      }

      const response = await fetch("/api/admin/create-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: editForm.email,
          password: editForm.password,
          name: `${editForm.first_name.trim()} ${editForm.middle_name.trim() ? editForm.middle_name.trim() + " " : ""}${editForm.last_name.trim()}`,
          status: editForm.status,
          address: editForm.address.trim() || "n/a",
          gender: editForm.gender,
          dateOfBirth: editForm.age, // Send as ISO string
          phoneNumber: editForm.phoneNumber.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create tenant");
      }

      setShowEditModal(false);
      setEditForm(defaultForm);
      setAutoGeneratePassword(false);
      setGeneratedPassword("");

      await fetchTenants();

      toast.success("Homeowner created successfully!");
    } catch (error) {
      console.error("Error creating tenant:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create tenant. Please try again."
      );
    }
  };

  const handleUpdateTenant = async () => {
    if (!validateForm() || !editingTenant) {
      return;
    }

    try {
      console.log("Updating tenant:", editingTenant._id);

      const fullName = `${editForm.first_name.trim()} ${editForm.middle_name.trim() ? editForm.middle_name.trim() + " " : ""}${editForm.last_name.trim()}`;

      const response = await fetch("/api/admin/update-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: editingTenant._id,
          name: fullName,
          email: editForm.email,
          status: editForm.status,
          address: editForm.address.trim() || "n/a",
          gender: editForm.gender,
          dateOfBirth: editForm.age, // Send date string
          phoneNumber: editForm.phoneNumber.trim() || "n/a",
        }),
      });

      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update tenant");
      }

      setTenants((prev) =>
        prev.map((t) =>
          t._id === editingTenant._id
            ? {
                ...t,
                user_name: fullName,
                user_email: editForm.email,
                status: editForm.status,
                address: editForm.address,
                gender: editForm.gender,
                age: parseInt(editForm.age) || 0,
                phoneNumber: editForm.phoneNumber,
              }
            : t
        )
      );

      setShowEditModal(false);
      setEditingTenant(null);
      setEditForm(defaultForm);
      toast.success("Tenant updated successfully!");
    } catch (error) {
      console.error("Error updating tenant:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update tenant. Please try again."
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      Active: "green",
      Inactive: "red",
      Evicted: "red",
      "Moved Out": "gray",
    };
    return (
      <Badge
        color={colors[status as keyof typeof colors] || "yellow"}
        variant="filled"
      >
        {status}
      </Badge>
    );
  };

  const filteredTenants = tenants.filter(
    (tenant) =>
      (tenant.user_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (tenant.user_email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
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
          <IconUsers size={32} color="blue" />
          <Box>
            <Title order={1}>Homeowners Management</Title>
            <Text c="dimmed">Manage all your homeowners</Text>
          </Box>
        </Group>
        <Group>
          <Button
            onClick={() => {
              setEditingTenant(null);
              setEditForm(defaultForm);
              setFormErrors({});
              setAutoGeneratePassword(false);
              setGeneratedPassword("");
              setShowEditModal(true);
            }}
          >
            Add New Homeowner
          </Button>
        </Group>
      </Group>

      {/* Search */}
      <Paper p="md" mb="md" shadow="sm">
        <TextInput
          placeholder="Search homeowners by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          style={{ maxWidth: 400 }}
        />
      </Paper>

      {/* Table */}
      <Paper shadow="sm">
        <ScrollArea type="auto">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Homeowner</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Created At</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredTenants.map((tenant) => (
                <Table.Tr key={tenant._id}>
                  <Table.Td>
                    <Text fw={500}>{tenant.user_name || "Unknown"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{tenant.user_email}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => {
                          setViewingTenant(tenant);
                          setShowViewModal(true);
                        }}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="green"
                        onClick={() => handleEditTenant(tenant)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {filteredTenants.length === 0 && (
          <Center py="xl">
            <Stack align="center">
              <IconUsers size={48} color="gray" />
              <Title order={3} c="dimmed">
                No homeowners found
              </Title>
              <Text c="dimmed">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "No homeowners available."}
              </Text>
            </Stack>
          </Center>
        )}
      </Paper>

      {/* Edit/Create Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setFormErrors({});
          setAutoGeneratePassword(false);
          setGeneratedPassword("");
        }}
        title={<>{editingTenant ? "Edit Homeowner" : "Create Homeowner"}</>}
        size="lg"
      >
        <Stack>
          {editingTenant?.property && (
            <Box className=" rounded-lg p-4">
              <Text size="sm" fw={500} mb="sm">
                Property Information
              </Text>
              <Group>
                <Box>
                  <Text size="xs" c="dimmed">
                    Property Title
                  </Text>
                  <Text size="sm">{editingTenant.property.title}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">
                    Location
                  </Text>
                  <Text size="sm">{editingTenant.property.location}</Text>
                </Box>
                {(editingTenant.property.type === "house-and-lot" ||
                  editingTenant.property.type === "condo") && (
                  <>
                    {editingTenant.property.bedrooms &&
                      editingTenant.property.bedrooms > 0 && (
                        <Box>
                          <Text size="xs" c="dimmed">
                            Bedrooms
                          </Text>
                          <Text size="sm">
                            {editingTenant.property.bedrooms} Bedroom
                            {editingTenant.property.bedrooms > 1 ? "s" : ""}
                          </Text>
                        </Box>
                      )}
                    {editingTenant.property.bathrooms &&
                      editingTenant.property.bathrooms > 0 && (
                        <Box>
                          <Text size="xs" c="dimmed">
                            Bathrooms
                          </Text>
                          <Text size="sm">
                            {editingTenant.property.bathrooms} Bathroom
                            {editingTenant.property.bathrooms > 1 ? "s" : ""}
                          </Text>
                        </Box>
                      )}
                    {editingTenant.property.sqft &&
                      editingTenant.property.sqft > 0 && (
                        <Box>
                          <Text size="xs" c="dimmed">
                            Square Footage
                          </Text>
                          <Text size="sm">
                            {editingTenant.property.sqft} sq ft
                          </Text>
                        </Box>
                      )}
                  </>
                )}
              </Group>
            </Box>
          )}
          <TextInput
            label="First Name"
            value={editForm.first_name}
            onChange={(e) =>
              setEditForm({ ...editForm, first_name: e.currentTarget.value })
            }
            required
            error={formErrors.first_name}
          />
          <TextInput
            label="Middle Name (Optional)"
            value={editForm.middle_name}
            onChange={(e) =>
              setEditForm({ ...editForm, middle_name: e.currentTarget.value })
            }
            error={formErrors.middle_name}
          />
          <TextInput
            label="Last Name"
            value={editForm.last_name}
            onChange={(e) =>
              setEditForm({ ...editForm, last_name: e.currentTarget.value })
            }
            required
            error={formErrors.last_name}
          />
          <TextInput
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) =>
              setEditForm({ ...editForm, email: e.currentTarget.value })
            }
            required
            error={formErrors.email}
          />
          <TextInput
            label="Address"
            value={editForm.address}
            onChange={(e) =>
              setEditForm({ ...editForm, address: e.currentTarget.value })
            }
            error={formErrors.address}
          />

          <TextInput
            label="Phone Number"
            value={editForm.phoneNumber}
            onChange={(e) =>
              setEditForm({ ...editForm, phoneNumber: e.currentTarget.value })
            }
            error={formErrors.phoneNumber}
          />

          <Group grow>
            <Select
              label="Gender"
              value={editForm.gender}
              onChange={(value) =>
                setEditForm({ ...editForm, gender: value || "" })
              }
              data={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
              required
              error={formErrors.gender}
            />
            <TextInput
              label="Date of Birth"
              type="date"
              value={editForm.age}
              onChange={(e) =>
                setEditForm({ ...editForm, age: e.currentTarget.value })
              }
              max={
                new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                  .toISOString()
                  .split("T")[0]
              }
              min={
                new Date(new Date().setFullYear(new Date().getFullYear() - 120))
                  .toISOString()
                  .split("T")[0]
              }
              required
              error={formErrors.age}
            />
          </Group>
          {!editingTenant && (
            <>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Auto-generate Password
                </Text>
                <input
                  type="checkbox"
                  checked={autoGeneratePassword}
                  onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                  style={{ cursor: "pointer", width: 20, height: 20 }}
                />
              </Group>

              {autoGeneratePassword && generatedPassword && (
                <Box
                  p="md"
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <Text size="sm" fw={500} mb="xs">
                    Generated Password:
                  </Text>
                  <Group gap="xs">
                    <TextInput
                      value={generatedPassword}
                      readOnly
                      style={{ flex: 1 }}
                      styles={{
                        input: {
                          fontFamily: "monospace",
                          fontSize: "14px",
                        },
                      }}
                    />
                    <Button
                      size="xs"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        toast.success("Password copied to clipboard!");
                      }}
                    >
                      Copy
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    Make sure to save this password. The homeowner will need it
                    to log in.
                  </Text>
                </Box>
              )}

              {!autoGeneratePassword && (
                <>
                  <PasswordInput
                    label="Password"
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        password: e.currentTarget.value,
                      })
                    }
                    required
                    error={formErrors.password}
                  />
                  
                  {/* Password Requirements Display - Fix 11 */}
                  <Box p="sm" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                    <Text size="xs" fw={600} mb="xs">Password requirements:</Text>
                    <Stack gap={4}>
                      <Group gap="xs">
                        {editForm.password.length >= 8 ? (
                          <IconCheck size={14} color="green" />
                        ) : (
                          <IconX size={14} color="gray" />
                        )}
                        <Text size="xs" c={editForm.password.length >= 8 ? "green" : "dimmed"}>
                          Use at least 8–12 characters
                        </Text>
                      </Group>
                      <Group gap="xs">
                        {/[A-Z]/.test(editForm.password) ? (
                          <IconCheck size={14} color="green" />
                        ) : (
                          <IconX size={14} color="gray" />
                        )}
                        <Text size="xs" c={/[A-Z]/.test(editForm.password) ? "green" : "dimmed"}>
                          Include at least one Uppercase Letter (A–Z)
                        </Text>
                      </Group>
                      <Group gap="xs">
                        {/[a-z]/.test(editForm.password) ? (
                          <IconCheck size={14} color="green" />
                        ) : (
                          <IconX size={14} color="gray" />
                        )}
                        <Text size="xs" c={/[a-z]/.test(editForm.password) ? "green" : "dimmed"}>
                          Include at least one Lowercase Letter (a–z)
                        </Text>
                      </Group>
                      <Group gap="xs">
                        {/[0-9]/.test(editForm.password) ? (
                          <IconCheck size={14} color="green" />
                        ) : (
                          <IconX size={14} color="gray" />
                        )}
                        <Text size="xs" c={/[0-9]/.test(editForm.password) ? "green" : "dimmed"}>
                          Include at least one Number (0–9)
                        </Text>
                      </Group>
                      <Group gap="xs">
                        {/[!@#$%^&*(),.?":{}|<>]/.test(editForm.password) ? (
                          <IconCheck size={14} color="green" />
                        ) : (
                          <IconX size={14} color="gray" />
                        )}
                        <Text size="xs" c={/[!@#$%^&*(),.?":{}|<>]/.test(editForm.password) ? "green" : "dimmed"}>
                          Include at least one Special Character (! @ # $ % ^ &amp; *)
                        </Text>
                      </Group>
                    </Stack>
                  </Box>
                  
                  <PasswordInput
                    label="Confirm Password"
                    value={editForm.confirmPassword}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        confirmPassword: e.currentTarget.value,
                      })
                    }
                    required
                    error={formErrors.confirmPassword}
                  />
                </>
              )}
            </>
          )}
          <Select
            label="Status"
            value={editForm.status}
            onChange={(value) =>
              setEditForm({ ...editForm, status: value || "Active" })
            }
            data={[
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setShowEditModal(false);
                setFormErrors({});
                setAutoGeneratePassword(false);
                setGeneratedPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingTenant ? handleUpdateTenant : () => {
                if (validateForm()) {
                  setShowConfirmModal(true);
                }
              }}
            >
              {editingTenant ? "Update Homeowner" : "Create Homeowner"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Modal */}
      <Modal
        opened={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Homeowner Details"
        size="lg"
      >
        {viewingTenant && (
          <Stack gap="md">
            <Box className="rounded-lg p-4">
              <Text size="sm" fw={500} mb="sm">
                Personal Information
              </Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Full Name:
                  </Text>
                  <Text size="sm" fw={500}>
                    {viewingTenant.user_name}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Email:
                  </Text>
                  <Text size="sm" fw={500}>
                    {viewingTenant.user_email}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Phone Number:
                  </Text>
                  <Text size="sm" fw={500}>
                    {viewingTenant.phoneNumber || "N/A"}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Address:
                  </Text>
                  <Text size="sm" fw={500}>
                    {viewingTenant.address || "N/A"}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Gender:
                  </Text>
                  <Text size="sm" fw={500}>
                    {viewingTenant.gender
                      ? viewingTenant.gender.charAt(0).toUpperCase() +
                        viewingTenant.gender.slice(1)
                      : "N/A"}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Age:
                  </Text>
                  <Text size="sm" fw={500}>
                    {viewingTenant.age || "N/A"}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Status:
                  </Text>
                  <div>{getStatusBadge(viewingTenant.status)}</div>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Created At:
                  </Text>
                  <Text size="sm" fw={500}>
                    {new Date(viewingTenant.created_at).toLocaleDateString()}
                  </Text>
                </Group>
              </Stack>
            </Box>

            {viewingTenant.property && (
              <Box className=" rounded-lg p-4">
                <Text size="sm" fw={500} mb="sm">
                  Property Information
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Property Title:
                    </Text>
                    <Text size="sm" fw={500}>
                      {viewingTenant.property.title}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Location:
                    </Text>
                    <Text size="sm" fw={500}>
                      {viewingTenant.property.location}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Type:
                    </Text>
                    <Text size="sm" fw={500}>
                      {viewingTenant.property.type}
                    </Text>
                  </Group>
                  {viewingTenant.property.bedrooms &&
                    viewingTenant.property.bedrooms > 0 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Bedrooms:
                        </Text>
                        <Text size="sm" fw={500}>
                          {viewingTenant.property.bedrooms}
                        </Text>
                      </Group>
                    )}
                  {viewingTenant.property.bathrooms &&
                    viewingTenant.property.bathrooms > 0 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Bathrooms:
                        </Text>
                        <Text size="sm" fw={500}>
                          {viewingTenant.property.bathrooms}
                        </Text>
                      </Group>
                    )}
                  {viewingTenant.property.sqft &&
                    viewingTenant.property.sqft > 0 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Square Footage:
                        </Text>
                        <Text size="sm" fw={500}>
                          {viewingTenant.property.sqft} sq ft
                        </Text>
                      </Group>
                    )}
                </Stack>
              </Box>
            )}

            <Group justify="flex-end" mt="md">
              <Button onClick={() => setShowViewModal(false)}>Close</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Confirmation Modal - Fix 7A */}
      <Modal
        opened={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Create Homeowner"
        centered
        size="sm"
      >
        <Stack>
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="blue"
            variant="light"
          >
            <Text size="sm">
              Are you sure you want to create this homeowner account?
            </Text>
          </Alert>
          
          <Box p="md" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Name:</Text>
                <Text size="sm" fw={500}>
                  {`${editForm.first_name} ${editForm.middle_name ? editForm.middle_name + ' ' : ''}${editForm.last_name}`.trim()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Email:</Text>
                <Text size="sm" fw={500}>{editForm.email}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Gender:</Text>
                <Text size="sm" fw={500}>
                  {editForm.gender ? editForm.gender.charAt(0).toUpperCase() + editForm.gender.slice(1) : 'N/A'}
                </Text>
              </Group>
            </Stack>
          </Box>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={() => {
                setShowConfirmModal(false);
                handleCreateTenant();
              }}
            >
              Confirm & Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default TenantsSection;
