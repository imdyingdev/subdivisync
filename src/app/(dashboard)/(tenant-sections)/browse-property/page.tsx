"use client";

import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Badge,
  Group,
  Stack,
  Button as MantineButton,
  Modal,
  TextInput,
  Textarea,
  Select,
  Loader,
  Center,
  AspectRatio,
  Notification,
  useMantineTheme,
  useMantineColorScheme,
  rgba,
} from "@mantine/core";
import {
  IconBuilding,
  IconMapPin,
  IconSquare,
  IconBed,
  IconBath,
  IconSearch,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useSession } from "@/lib/auth-client";
import { CustomCarousel } from "./_components/custom-carousel";

// Property interface
interface Property {
  _id: string;
  title: string;
  location: string;
  size: string;
  price: number;
  type: "single-attached" | "duplex" | "two-storey-house";
  status: "CREATED" | "UNDER_INQUIRY" | "APPROVED" | "REJECTED" | "LEASED";
  images?: string[];
  amenities: string[];
  description?: string;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  inquiries?: {
    fullName: string;
    email: string;
    phone: string;
    reason: string;
    submittedAt: string;
    status: "pending" | "approved" | "rejected";
  }[];
}

// InquiryRequest interface
interface InquiryRequest {
  fullName: string;
  email: string;
  phone: string;
  reason: string;
}

interface NotificationType {
  type: "success" | "error";
  message: string;
}

const PropertyListingPage = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [notification, setNotification] = useState<NotificationType | null>(
    null
  );
  const [inquiryForm, setInquiryForm] = useState<InquiryRequest>({
    fullName: "",
    email: "",
    phone: "",
    reason: "",
  });

  const { data: session } = useSession();

  const primaryTextColor = colorScheme === "dark" ? "white" : "dark";
  const getDefaultShadow = () => {
    const baseShadow = "0 1px 3px";
    const opacity = colorScheme === "dark" ? 0.2 : 0.12;
    return `${baseShadow} ${rgba(theme.black, opacity)}`;
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
      setInquiryForm((prev) => ({
        ...prev,
        email: session.user.email,
      }));
    }
  }, [session]);

  // Load properties from API - Using public access
  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          public: "true",
          limit: "50",
          page: "1",
        });

        const response = await fetch(`/api/properties?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch properties");
        }

        setProperties(data.properties || []);
        setFilteredProperties(data.properties || []);
      } catch (err) {
        console.error("Error loading properties:", err);
        showNotification(
          "error",
          (err as Error).message ||
            "Failed to load properties. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, []);

  // Filter properties based on search and type
  useEffect(() => {
    let filtered = properties;

    if (searchQuery) {
      filtered = filtered.filter(
        (property) =>
          property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          property.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          property.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      );
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((property) => property.type === selectedType);
    }

    setFilteredProperties(filtered);
  }, [properties, searchQuery, selectedType]);

  // Validate inquiry form
  const validateInquiryForm = (form: InquiryRequest) => {
    const errors: string[] = [];

    if (!form.fullName || form.fullName.trim().length < 2) {
      errors.push("Full name must be at least 2 characters");
    } else if (!/^[a-zA-Z\s-]+$/.test(form.fullName)) {
      errors.push("Full name can only contain letters, spaces, and hyphens");
    }

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.push("Please enter a valid email address");
    }

    if (!form.phone || !/^\+?\d{10,12}$/.test(form.phone.replace(/\s/g, ""))) {
      errors.push("Please enter a valid phone number (10-12 digits)");
    }

    if (!form.reason || form.reason.trim().length < 10) {
      errors.push("Reason for inquiry must be at least 10 characters");
    }

    return errors;
  };

  const handleInputChange = (field: keyof InquiryRequest, value: string) => {
    setInquiryForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (propertyId: string) => {
    const validationErrors = validateInquiryForm(inquiryForm);
    if (validationErrors.length > 0) {
      showNotification("error", validationErrors[0]);
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inquiry: {
            fullName: inquiryForm.fullName.trim(),
            email: inquiryForm.email.trim(),
            phone: inquiryForm.phone.trim(),
            reason: inquiryForm.reason.trim(),
            submittedAt: new Date().toISOString(),
            status: "pending",
          },
          isInquiry: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit inquiry");
      }

      showNotification(
        "success",
        "Your inquiry has been submitted successfully!"
      );
      setSelectedProperty(null);
      setInquiryForm({
        fullName: "",
        email: session?.user?.email || userEmail,
        phone: "",
        reason: "",
      });
    } catch (err) {
      console.error("Error submitting inquiry:", err);
      showNotification(
        "error",
        (err as Error).message || "Failed to submit inquiry. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CREATED":
        return "green";
      case "UNDER_INQUIRY":
        return "yellow";
      case "APPROVED":
        return "blue";
      case "REJECTED":
        return "red";
      case "LEASED":
        return "violet";
      default:
        return "gray";
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case "CREATED":
        return "Available for Inquiry";
      case "UNDER_INQUIRY":
        return "Currently Under Review";
      case "APPROVED":
        return "Inquiry Approved";
      case "REJECTED":
        return "Inquiry Rejected";
      case "LEASED":
        return "Property Leased";
      default:
        return status;
    }
  };
  if (loading) {
    return (
      <Container size="100%" py="xl">
        <Center style={{ height: 400 }}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="100%" py="xl">
      {notification && (
        <Notification
          icon={
            notification.type === "success" ? (
              <IconCheck size={18} />
            ) : (
              <IconX size={18} />
            )
          }
          color={notification.type === "success" ? "green" : "red"}
          title={notification.type === "success" ? "Success" : "Error"}
          onClose={() => setNotification(null)}
          style={{ position: "fixed", top: 20, right: 20, zIndex: 1000 }}
        >
          {notification.message}
        </Notification>
      )}
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1} size="h2" fw={600} c={primaryTextColor}>
            Properties
          </Title>
          <Text c="dimmed" size="md" lh={1.5}>
            Browse available properties
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <TextInput
            placeholder="Search by title, location, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftSection={<IconSearch size={16} />}
          />
          <Select
            value={selectedType}
            onChange={(value) => setSelectedType(value || "all")}
            data={[
              { value: "all", label: "All Types" },
              { value: "single-attached", label: "Single-Attached" },
              { value: "duplex", label: "Duplex" },
              { value: "two-storey-house", label: "Two-Storey House" },
            ]}
          />
        </SimpleGrid>

        <Text c="dimmed" size="sm">
          Showing {filteredProperties.length} of {properties.length} properties
        </Text>

        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
          {filteredProperties.map((property) => (
            <Card
              key={property._id}
              shadow="sm"
              padding="lg"
              radius="lg"
              withBorder
              style={{ 
                boxShadow: getDefaultShadow(),
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 25px ${rgba(theme.black, 0.15)}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = getDefaultShadow();
              }}
            >
              <AspectRatio ratio={16 / 9}>
                {property.images && property.images.length > 0 ? (
                  <CustomCarousel
                    images={property.images}
                    alt={property.title}
                    showIndicators={true}
                    autoPlay={false}
                  />
                ) : (
                  <Center>
                    <IconBuilding size={48} color="gray" />
                  </Center>
                )}
              </AspectRatio>

              <Stack gap="md" mt="md">
                <Group justify="space-between" align="flex-start">
                  <Title order={3} size="h3" fw={600} c={primaryTextColor}>
                    {property.title}
                  </Title>
                  <Badge
                    color={getStatusColor(property.status)}
                    variant="light"
                  >
                    {getStatusMessage(property.status)}
                  </Badge>
                </Group>

                <Group gap="xs">
                  <IconMapPin size={16} color={colorScheme === "dark" ? "#9ca3af" : "gray"} />
                  <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"}>
                    {property.location}
                  </Text>
                </Group>

                <Text fw={700} size="xl" c="green">
                  ₱{property.price.toLocaleString("en-PH")}
                </Text>

                <SimpleGrid cols={2}>
                  <Group gap="xs">
                    <IconBuilding size={16} color={colorScheme === "dark" ? "#9ca3af" : "gray"} />
                    <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"}>
                      {property.type
                        .replace("-", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <IconSquare size={16} color={colorScheme === "dark" ? "#9ca3af" : "gray"} />
                    <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"}>
                      {property.size}
                    </Text>
                  </Group>
                  {(property.bedrooms ?? 0) > 0 && (
                    <Group gap="xs">
                      <IconBed size={16} color={colorScheme === "dark" ? "#9ca3af" : "gray"} />
                      <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"}>
                        {property.bedrooms} Bedroom
                        {property.bedrooms !== 1 ? "s" : ""}
                      </Text>
                    </Group>
                  )}
                  {(property.bathrooms ?? 0) > 0 && (
                    <Group gap="xs">
                      <IconBath size={16} color={colorScheme === "dark" ? "#9ca3af" : "gray"} />
                      <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"}>
                        {property.bathrooms} Bathroom
                        {property.bathrooms !== 1 ? "s" : ""}
                      </Text>
                    </Group>
                  )}
                  {(property.sqft ?? 0) > 0 && (
                    <Group gap="xs">
                      <IconSquare size={16} color={colorScheme === "dark" ? "#9ca3af" : "gray"} />
                      <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"}>
                        {property.sqft} sq ft
                      </Text>
                    </Group>
                  )}
                </SimpleGrid>

                {property.description && (
                  <Text size="sm" c={colorScheme === "dark" ? "gray.4" : "dimmed"} lineClamp={2}>
                    {property.description}
                  </Text>
                )}

                {property.amenities && property.amenities.length > 0 && (
                  <Group gap="xs" grow wrap="wrap">
                    {property.amenities.slice(0, 3).map((amenity, index) => (
                      <Badge key={index} variant="light" color="gray">
                        {amenity.replace("-", " ")}
                      </Badge>
                    ))}
                    {property.amenities.length > 3 && (
                      <Badge variant="light" color="gray">
                        +{property.amenities.length - 3} more
                      </Badge>
                    )}
                  </Group>
                )}

                <MantineButton
                  onClick={() => setSelectedProperty(property)}
                  disabled={property.status !== "CREATED"}
                  fullWidth
                  color="blue"
                >
                  {property.status === "CREATED"
                    ? "View Details & Inquire"
                    : "View Details"}
                </MantineButton>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        {filteredProperties.length === 0 && (
          <Center py="xl">
            <Stack align="center">
              <IconBuilding size={48} color="gray" />
              <Text c="dimmed" size="md">
                {searchQuery || selectedType !== "all"
                  ? "No properties match your search or type."
                  : "No properties found."}
              </Text>
            </Stack>
          </Center>
        )}
      </Stack>

      <Modal
        opened={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
        size="xl"
        title={
          <Title order={2} c={primaryTextColor}>
            {selectedProperty?.title}
          </Title>
        }
        centered
      >
        {selectedProperty && (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
            <Stack>
              <AspectRatio ratio={16 / 9}>
                {selectedProperty.images &&
                selectedProperty.images.length > 0 ? (
                  <CustomCarousel
                    images={selectedProperty.images}
                    alt={selectedProperty.title}
                    showIndicators={true}
                    autoPlay={true}
                    autoPlayInterval={4000}
                  />
                ) : (
                  <Center>
                    <IconBuilding size={48} color="gray" />
                  </Center>
                )}
              </AspectRatio>

              <Group gap="xs">
                <IconMapPin size={18} color="gray" />
                <Text size="md" c="dimmed">
                  {selectedProperty.location}
                </Text>
              </Group>

              <Text fw={700} size="xl" c="green">
                ₱{selectedProperty.price.toLocaleString("en-PH")}
              </Text>

              <SimpleGrid cols={2}>
                <Group gap="xs">
                  <IconBuilding size={18} color="gray" />
                  <Text size="md" c="dimmed">
                    {selectedProperty.type
                      .replace("-", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                </Group>
                <Group gap="xs">
                  <IconSquare size={18} color="gray" />
                  <Text size="md" c="dimmed">
                    {selectedProperty.size}
                  </Text>
                </Group>
                {(selectedProperty.bedrooms ?? 0) > 0 && (
                  <Group gap="xs">
                    <IconBed size={18} color="gray" />
                    <Text size="md" c="dimmed">
                      {selectedProperty.bedrooms} Bedroom
                      {selectedProperty.bedrooms !== 1 ? "s" : ""}
                    </Text>
                  </Group>
                )}
                {(selectedProperty.bathrooms ?? 0) > 0 && (
                  <Group gap="xs">
                    <IconBath size={18} color="gray" />
                    <Text size="md" c="dimmed">
                      {selectedProperty.bathrooms} Bathroom
                      {selectedProperty.bathrooms !== 1 ? "s" : ""}
                    </Text>
                  </Group>
                )}
                {(selectedProperty.sqft ?? 0) > 0 && (
                  <Group gap="xs">
                    <IconSquare size={18} color="gray" />
                    <Text size="md" c="dimmed">
                      {selectedProperty.sqft} sq ft
                    </Text>
                  </Group>
                )}
              </SimpleGrid>

              {selectedProperty.description && (
                <Stack gap="xs">
                  <Title order={4} fw={600} c={primaryTextColor}>
                    Description
                  </Title>
                  <Text size="sm" c="dimmed">
                    {selectedProperty.description}
                  </Text>
                </Stack>
              )}

              {selectedProperty.amenities &&
                selectedProperty.amenities.length > 0 && (
                  <Stack gap="xs">
                    <Title order={4} fw={600} c={primaryTextColor}>
                      Amenities
                    </Title>
                    <SimpleGrid cols={2}>
                      {selectedProperty.amenities.map((amenity, index) => (
                        <Group key={index} gap="xs">
                          <Text size="sm" c="dimmed">
                            {amenity.replace("-", " ")}
                          </Text>
                        </Group>
                      ))}
                    </SimpleGrid>
                  </Stack>
                )}
            </Stack>

            <Stack>
              {selectedProperty.status === "CREATED" ? (
                <Stack gap="md">
                  <Title order={3} fw={600} c={primaryTextColor}>
                    Submit Inquiry
                  </Title>

                  <TextInput
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={inquiryForm.fullName}
                    onChange={(e) =>
                      handleInputChange("fullName", e.currentTarget.value)
                    }
                    required
                    disabled={submitting}
                  />

                  <TextInput
                    label="Email"
                    type="email"
                    placeholder="Enter your email"
                    value={inquiryForm.email}
                    onChange={(e) =>
                      handleInputChange("email", e.currentTarget.value)
                    }
                    required
                    disabled={submitting || !!session?.user?.email}
                  />

                  <TextInput
                    label="Phone"
                    placeholder="Enter your phone number"
                    value={inquiryForm.phone}
                    onChange={(e) =>
                      handleInputChange("phone", e.currentTarget.value)
                    }
                    required
                    disabled={submitting}
                  />

                  <Textarea
                    label="Reason for Inquiry"
                    placeholder="Explain why you're interested in this property..."
                    value={inquiryForm.reason}
                    onChange={(e) =>
                      handleInputChange("reason", e.currentTarget.value)
                    }
                    minRows={4}
                    required
                    disabled={submitting}
                  />

                  <MantineButton
                    onClick={() => handleSubmit(selectedProperty._id)}
                    loading={submitting}
                    fullWidth
                    color="blue"
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Inquiry"}
                  </MantineButton>
                </Stack>
              ) : (
                <Center h={300}>
                  <Stack align="center" gap="md">
                    <Badge
                      color={getStatusColor(selectedProperty.status)}
                      size="lg"
                      variant="light"
                    >
                      {getStatusMessage(selectedProperty.status)}
                    </Badge>
                    <Text c="dimmed" size="md">
                      This property is not available for new inquiries.
                    </Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          </SimpleGrid>
        )}
      </Modal>
    </Container>
  );
};

export default PropertyListingPage;
