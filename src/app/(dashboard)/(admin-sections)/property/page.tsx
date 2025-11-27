"use client";
import {
  Title,
  Text,
  Grid,
  Card,
  Group,
  Stack,
  Badge,
  ActionIcon,
  SimpleGrid,
  Container,
  Flex,
  Box,
  ThemeIcon,
  Table,
  Loader,
  Center,
  Notification,
  useMantineTheme,
  useMantineColorScheme,
  rgba,
  Modal,
  TextInput,
  Select,
  Textarea,
  Button as MantineButton,
  NumberInput,
  Image,
  ScrollArea,
} from "@mantine/core";
import {
  IconBuilding,
  IconMapPin,
  IconSearch,
  IconEye,
  IconEdit,
  IconPlus,
  IconBed,
  IconDroplet,
  IconSquareRounded,
  IconUpload,
  IconFileText,
  IconUsers,
  IconMail,
  IconPhone,
  IconAlertTriangle,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { useEffect, useState, useRef } from "react";
import { uploadImageToServer, validateImageFile } from "@/lib/upload";
import CustomCarousel from "./_components/carousel";
import { toast } from "react-hot-toast"; // Keep for now, but can migrate to Mantine notifications later
// Types (unchanged)
interface PropertyOwner {
  fullName?: string;
  email?: string;
  phone?: string;
}
interface Inquiry {
  _id: string;
  propertyId: string;
  tenantId: string;
  reason: string;
  duration: string;
  status: "UNDER_INQUIRY" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  created_at: string;
}
interface Property {
  _id: string;
  title: string;
  location: string;
  size: string;
  price: number;
  type: "single-attached" | "duplex" | "two-storey-house";
  status: "CREATED" | "UNDER_INQUIRY" | "APPROVED" | "REJECTED" | "LEASED";
  images?: string[];
  features: string[];
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  owner?: PropertyOwner;
  inquiry?: Inquiry;
}
interface CreatePropertyRequest {
  title: string;
  location: string;
  size: string;
  price: string;
  type: string;
  status: "CREATED" | "UNDER_INQUIRY" | "APPROVED" | "REJECTED" | "LEASED";
  images?: string[];
  features?: string[];
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
}
interface UpdatePropertyRequest extends CreatePropertyRequest {
  owner_details?: {
    fullName: string;
    email: string;
    phone: string;
  };
}
interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
interface ImageUploadPreviewProps {
  images: string[] | undefined;
  selectedImages: File[];
  onImageChange: (files: File[], isEdit: boolean) => void;
  onRemoveImage: (index: number, type: "existing" | "new") => void;
  isEdit?: boolean;
}
type ImageType = "existing" | "new";
interface NotificationType {
  type: "success" | "error";
  message: string;
}
// Image Upload Preview Component (Updated to Mantine)
const ImageUploadPreview: React.FC<ImageUploadPreviewProps> = ({
  images,
  selectedImages,
  onImageChange,
  onRemoveImage,
  isEdit = false,
}) => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validationErrors = files
        .map((file) => validateImageFile(file))
        .filter((v) => !v.valid);
      if (validationErrors.length > 0) {
        toast.error(validationErrors[0].error || "Invalid image file");
        return;
      }
      onImageChange(files, isEdit);
      toast.success(
        `${files.length} image${files.length > 1 ? "s" : ""} selected`
      );
    }
  };
  const handleRemoveClick = (index: number, type: ImageType): void => {
    onRemoveImage(index, type);
    toast.success("Image removed");
  };
  const inputId = isEdit ? "edit-images" : "images";
  return (
    <Stack gap="md">
      <Text size="sm" fw={500} c="dimmed">
        Property Images
      </Text>
      <Group>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <MantineButton
          variant="default"
          leftSection={<IconUpload size={16} />}
          onClick={() => inputRef.current?.click()}
        >
          Select Images
        </MantineButton>
        <Text size="sm" c="dimmed">
          {selectedImages.length} new images selected
        </Text>
      </Group>
      {images && images.length > 0 && (
        <Box>
          <Text size="sm" fw={500} mb="xs" c="dimmed">
            Current Images:
          </Text>
          <SimpleGrid cols={3} spacing="sm">
            {images.map((image: string, index: number) => (
              <Box key={`existing-${index}`} pos="relative">
                <Image
                  src={image}
                  alt={`Property ${index + 1}`}
                  height={96}
                  width={96}
                  style={{
                    objectFit: "cover",
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.gray[colorScheme === "dark" ? 7 : 3]}`,
                  }}
                />
                <ActionIcon
                  variant="filled"
                  color="red"
                  size="xs"
                  onClick={() => handleRemoveClick(index, "existing")}
                  pos="absolute"
                  top={4}
                  right={4}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}
      {selectedImages.length > 0 && (
        <Box>
          <Text size="sm" fw={500} mb="xs" c="dimmed">
            New Images:
          </Text>
          <SimpleGrid cols={3} spacing="sm">
            {selectedImages.map((file: File, index: number) => (
              <Box key={`new-${index}`} pos="relative">
                <Image
                  src={URL.createObjectURL(file)}
                  alt={`New ${index + 1}`}
                  height={96}
                  width={96}
                  style={{
                    objectFit: "cover",
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.gray[colorScheme === "dark" ? 7 : 3]}`,
                  }}
                />
                <ActionIcon
                  variant="filled"
                  color="red"
                  size="xs"
                  onClick={() => handleRemoveClick(index, "new")}
                  pos="absolute"
                  top={4}
                  right={4}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </Stack>
  );
};
// Main Component
export default function PropertyManagement() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    pages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationType | null>(
    null
  );
  const [dataFetched, setDataFetched] = useState(false);
  const [formData, setFormData] = useState<CreatePropertyRequest>({
    title: "",
    location: "",
    size: "",
    price: "",
    type: "residential-lot",
    status: "CREATED",
    images: [],
    features: [],
    description: "",
    bedrooms: 0,
    bathrooms: 0,
    sqft: 0,
  });
  const [editFormData, setEditFormData] = useState<
    CreatePropertyRequest & { _id?: string }
  >({
    title: "",
    location: "",
    size: "",
    price: "",
    type: "residential-lot",
    status: "CREATED",
    images: [],
    features: [],
    description: "",
    bedrooms: 0,
    bathrooms: 0,
    sqft: 0,
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [ownerDetails, setOwnerDetails] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  // Theme-aware helpers (from dashboard)
  const primaryTextColor = colorScheme === "dark" ? "white" : "dark.9";
  const getDefaultShadow = () => {
    const baseShadow = "0 1px 3px";
    const opacity = colorScheme === "dark" ? 0.2 : 0.12;
    return `${baseShadow} ${rgba(theme.black, opacity)}`;
  };
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };
  const fetchProperties = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const response = await fetch(`/api/properties?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch properties");
      }
      setProperties(data.properties);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching properties:", error);
      const errorMessage =
        (error as Error).message || "Failed to fetch properties";
      setError(errorMessage);
      showNotification("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };
  // Fixed refresh bug - only fetch data once and when searchQuery changes
  useEffect(() => {
    if (!dataFetched) {
      fetchProperties();
      setDataFetched(true);
    }
  }, [dataFetched]);
  // Fetch when search query changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (dataFetched) {
        fetchProperties(1); // Reset to page 1 when searching
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, dataFetched]);
  // useEffect(() => {
  //   if (formData.type !== "house-and-lot" && formData.type !== "condo") {
  //     setFormData({
  //       ...formData,
  //       bedrooms: undefined,
  //       bathrooms: undefined,
  //     });
  //   }
  // }, [formData.type]);
  // useEffect(() => {
  //   if (
  //     editFormData.type !== "house-and-lot" &&
  //     editFormData.type !== "condo"
  //   ) {
  //     setEditFormData({
  //       ...editFormData,
  //       bedrooms: undefined,
  //       bathrooms: undefined,
  //     });
  //   }
  // }, [editFormData.type]);
  // Helper to format price with commas for display
  const formatPriceInput = (value: string): string => {
    // Remove all non-digit characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    // Split by decimal point
    const parts = cleanValue.split('.');
    // Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Helper to strip commas from price for validation/submission
  const stripCommas = (value: string): string => {
    return value.replace(/,/g, '');
  };

  const validateForm = (data: CreatePropertyRequest): string | null => {
    if (!data.title.trim()) return "Property title is required";
    if (!data.location.trim()) return "Location is required";
    if (!data.size.trim()) return "Size is required";
    if (!data.price.trim()) return "Price is required";
    // Strip commas before validating
    const cleanPrice = stripCommas(data.price);
    if (!/^\d+(\.\d+)?$/.test(cleanPrice))
      return "Price must be a valid number";
    return null;
  };
  const handleImageChange = (files: File[], isEdit: boolean): void => {
    setSelectedImages((prevImages) => [...prevImages, ...files]);
  };
  const handleRemoveImage = (index: number, type: ImageType): void => {
    if (type === "existing") {
      const currentFormData = editModalOpen ? editFormData : formData;
      const updatedImages =
        currentFormData.images?.filter((_, i) => i !== index) || [];
      if (editModalOpen) {
        setEditFormData({ ...editFormData, images: updatedImages });
      } else {
        setFormData({ ...formData, images: updatedImages });
      }
    } else if (type === "new") {
      setSelectedImages((prevImages) =>
        prevImages.filter((_, i) => i !== index)
      );
    }
  };
  const handleCreateProperty = async (): Promise<void> => {
    try {
      const validationError = validateForm(formData);
      if (validationError) {
        setError(validationError);
        showNotification("error", validationError);
        return;
      }
      setCreateLoading(true);
      setError(null);
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(
          async (file: File): Promise<string> => {
            try {
              const validation = validateImageFile(file);
              if (!validation.valid) {
                throw new Error(validation.error);
              }
              const result = await uploadImageToServer(file);
              if (!result.success) {
                throw new Error(
                  result.error || `Failed to upload ${file.name}`
                );
              }
              return result.imageUrl!;
            } catch (uploadError) {
              console.error("Error uploading file:", file.name, uploadError);
              throw new Error(`Failed to upload ${file.name}`);
            }
          }
        );
        imageUrls = await Promise.all(uploadPromises);
      }
      const requestBody: CreatePropertyRequest = {
        ...formData,
        price: stripCommas(formData.price), // Remove commas before sending to API
        images: [...(formData.images || []), ...imageUrls],
        status: formData.status as
          | "CREATED"
          | "UNDER_INQUIRY"
          | "APPROVED"
          | "REJECTED"
          | "LEASED",
      };
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const data: { success: boolean; property?: Property; error?: string } =
        await response.json();
      if (!data.success || !data.property) {
        throw new Error(data.error || "Failed to create property");
      }
      setProperties([...properties, data.property]);
      setCreateModalOpen(false);
      setFormData({
        title: "",
        location: "",
        size: "",
        price: "",
        type: "residential-lot",
        status: "CREATED",
        images: [],
        features: [],
        description: "",
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
      });
      setSelectedImages([]);
      showNotification("success", "Property created successfully");
    } catch (error) {
      console.error("Error creating property:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create property";
      setError(errorMessage);
      showNotification("error", errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };
  const handleEditProperty = async (): Promise<void> => {
    try {
      const validationError = validateForm(editFormData);
      if (validationError) {
        setError(validationError);
        showNotification("error", validationError);
        return;
      }
      setError(null);
      let newImageUrls: string[] = [];
      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(
          async (file: File): Promise<string> => {
            try {
              const validation = validateImageFile(file);
              if (!validation.valid) {
                throw new Error(validation.error);
              }
              const result = await uploadImageToServer(file);
              if (!result.success) {
                throw new Error(
                  result.error || `Failed to upload ${file.name}`
                );
              }
              return result.imageUrl!;
            } catch (uploadError) {
              console.error("Error uploading file:", file.name, uploadError);
              throw new Error(`Failed to upload ${file.name}`);
            }
          }
        );
        newImageUrls = await Promise.all(uploadPromises);
      }
      const requestBody: UpdatePropertyRequest = {
        title: editFormData.title,
        location: editFormData.location,
        size: editFormData.size,
        price: stripCommas(editFormData.price), // Remove commas before sending to API
        type: editFormData.type,
        status: editFormData.status,
        images: [...(editFormData.images || []), ...newImageUrls],
        features: editFormData.features || [],
        description: editFormData.description || "",
        bedrooms: editFormData.bedrooms || 0,
        bathrooms: editFormData.bathrooms || 0,
        sqft: editFormData.sqft || 0,
      };
      if (editFormData.status === "LEASED") {
        if (!ownerDetails.fullName.trim() || !ownerDetails.email.trim()) {
          const errorMessage =
            "Owner name and email are required for leased properties";
          setError(errorMessage);
          showNotification("error", errorMessage);
          return;
        }
        requestBody.owner_details = {
          fullName: ownerDetails.fullName,
          email: ownerDetails.email,
          phone: ownerDetails.phone,
        };
      }
      const response = await fetch(`/api/properties/${editFormData._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const data: { success: boolean; property?: Property; error?: string } =
        await response.json();
      if (!data.success || !data.property) {
        throw new Error(data.error || "Failed to update property");
      }
      setProperties(
        properties.map((p) =>
          p._id === data.property!._id ? data.property! : p
        )
      );
      setEditModalOpen(false);
      setEditFormData({
        title: "",
        location: "",
        size: "",
        price: "",
        type: "residential-lot",
        status: "CREATED",
        images: [],
        features: [],
        description: "",
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
      });
      setSelectedImages([]);
      setOwnerDetails({ fullName: "", email: "", phone: "" });
      showNotification("success", "Property updated successfully");
    } catch (error) {
      console.error("Error updating property:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update property";
      setError(errorMessage);
      showNotification("error", errorMessage);
    }
  };
  const handleDeleteProperty = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;
    try {
      setError(null);
      const response = await fetch(`/api/properties/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete property");
      }
      setProperties(properties.filter((p) => p._id !== id));
      showNotification("success", "Property deleted successfully");
    } catch (error) {
      console.error("Error deleting property:", error);
      const errorMessage =
        (error as Error).message || "Failed to delete property";
      setError(errorMessage);
      showNotification("error", errorMessage);
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "CREATED":
        return "gray";
      case "UNDER_INQUIRY":
        return "yellow";
      case "APPROVED":
        return "green";
      case "REJECTED":
        return "red";
      case "LEASED":
        return "blue";
      default:
        return "gray";
    }
  };
  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });
  const stats = {
    total: pagination.total,
    created: properties.filter((p) => p.status === "CREATED").length,
    leased: properties.filter((p) => p.status === "LEASED").length,
    underInquiry: properties.filter((p) => p.status === "UNDER_INQUIRY").length,
  };
  const handleFeaturesChange = (value: string, isEdit: boolean = false) => {
    const currentFeatures = isEdit
      ? editFormData.features || []
      : formData.features || [];
    if (currentFeatures.includes(value)) {
      const newFeatures = currentFeatures.filter((a) => a !== value);
      if (isEdit) {
        setEditFormData({ ...editFormData, features: newFeatures });
      } else {
        setFormData({ ...formData, features: newFeatures });
      }
      showNotification(
        "success",
        `${value.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())} removed from features`
      );
    } else {
      const newFeatures = [...currentFeatures, value];
      if (isEdit) {
        setEditFormData({ ...editFormData, features: newFeatures });
      } else {
        setFormData({ ...formData, features: newFeatures });
      }
      showNotification(
        "success",
        `${value.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())} added to features`
      );
    }
  };
  const openEditModal = (property: Property) => {
    setEditFormData({
      _id: property._id,
      title: property.title,
      location: property.location,
      size: property.size,
      price: formatPriceInput(property.price.toString()),
      type: property.type,
      status: property.status,
      images: property.images || [],
      features: property.features || [],
      description: property.description || "",
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.sqft || 0,
    });
    setOwnerDetails({
      fullName: property.owner?.fullName || "",
      email: property.owner?.email || "",
      phone: property.owner?.phone || "",
    });
    setSelectedImages([]);
    setEditModalOpen(true);
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };
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
    <Container size="xl" px="md">
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
        {/* Header */}
        <Box py="md">
          <Title order={1} size="h2" fw={600} c={primaryTextColor} mb="xs">
            Property Management
          </Title>
          <Text c="dimmed" size="md" lh={1.5}>
            Manage your property listings and inquiries
          </Text>
        </Box>
        {/* Stats Cards (Updated to match dashboard) */}
        <SimpleGrid
          cols={{ base: 1, md: 3 }}
          spacing={{ base: "md", sm: "lg" }}
          verticalSpacing={{ base: "md", sm: "lg" }}
        >
          <Card
            padding="xl"
            radius="lg"
            withBorder
            shadow="sm"
            style={{
              background:
                "linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-blue-7) 100%)",
              color: "white",
              boxShadow: getDefaultShadow(),
            }}
          >
            <Flex justify="space-between" align="flex-start" gap="md">
              <Stack gap="xs" flex={1}>
                <Text c="blue.2" size="sm" tt="uppercase" fw={600}>
                  Total Listed
                </Text>
                <Text fw={700} size="xl" c="white" lh={1.2}>
                  {stats.total}
                </Text>
              </Stack>
              <ThemeIcon
                variant="light"
                color="blue"
                size="xl"
                radius="lg"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.2)", color: "white", boxShadow: getDefaultShadow() }}
              >
                <IconBuilding size="1.5rem" color="white" />
              </ThemeIcon>
            </Flex>
          </Card>
          <Card
            padding="xl"
            radius="lg"
            withBorder
            shadow="sm"
            style={{
              background:
                "linear-gradient(135deg, var(--mantine-color-yellow-6) 0%, var(--mantine-color-yellow-7) 100%)",
              color: "white",
              boxShadow: getDefaultShadow(),
            }}
          >
            <Flex justify="space-between" align="flex-start" gap="md">
              <Stack gap="xs" flex={1}>
                <Text c="yellow.2" size="sm" tt="uppercase" fw={600}>
                  Under Inquiry
                </Text>
                <Text fw={700} size="xl" c="white" lh={1.2}>
                  {stats.underInquiry}
                </Text>
              </Stack>
              <ThemeIcon
                variant="light"
                color="yellow"
                size="xl"
                radius="lg"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.2)", color: "white", boxShadow: getDefaultShadow() }}
              >
                <IconFileText size="1.5rem" color="white" />
              </ThemeIcon>
            </Flex>
          </Card>
          <Card
            padding="xl"
            radius="lg"
            withBorder
            shadow="sm"
            style={{
              background:
                "linear-gradient(135deg, var(--mantine-color-violet-6) 0%, var(--mantine-color-violet-7) 100%)",
              color: "white",
              boxShadow: getDefaultShadow(),
            }}
          >
            <Flex justify="space-between" align="flex-start" gap="md">
              <Stack gap="xs" flex={1}>
                <Text c="violet.2" size="sm" tt="uppercase" fw={600}>
                  Leased
                </Text>
                <Text fw={700} size="xl" c="white" lh={1.2}>
                  {stats.leased}
                </Text>
              </Stack>
              <ThemeIcon
                variant="light"
                color="violet"
                size="xl"
                radius="lg"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.2)", color: "white", boxShadow: getDefaultShadow() }}
              >
                <IconUsers size="1.5rem" color="white" />
              </ThemeIcon>
            </Flex>
          </Card>
        </SimpleGrid>
        {/* Error Alert (Updated to Mantine Notification style) */}
        {error && (
          <Notification
            icon={<IconAlertTriangle size={18} />}
            color="red"
            title="Error Occurred"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Notification>
        )}
        {/* Properties List */}
        <Card padding="xl" radius="lg" withBorder shadow="sm">
          <Group justify="space-between" mb="md">
            <Title order={3} size="h4" fw={600} c={primaryTextColor}>
              Manage Properties
            </Title>
            <Group>
              <TextInput
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<IconSearch size={16} />}
                style={{ maxWidth: 300 }}
              />
              <MantineButton
                onClick={() => setCreateModalOpen(true)}
                leftSection={<IconPlus size={16} />}
              >
                Add Property
              </MantineButton>
            </Group>
          </Group>
          {/* Added ScrollArea for horizontal overflow */}
          <ScrollArea type="auto">
            <Table striped highlightOnHover miw={800}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Property</Table.Th>
                  <Table.Th>Block/Street</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Landsize</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredProperties.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} ta="center" py="xl">
                      <ThemeIcon size={48} radius="xl" color="gray" mb="md">
                        <IconBuilding size={24} />
                      </ThemeIcon>
                      <Text size="lg" fw={500} c={primaryTextColor} mb="xs">
                        No properties found
                      </Text>
                      <Text c="dimmed">
                        Create a new property to get started
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredProperties.map((property) => (
                    <Table.Tr key={property._id}>
                      <Table.Td>
                        <Text fw={500} c={primaryTextColor}>
                          {property.title}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconMapPin size={16} />
                          <Text c="dimmed">{property.location}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray">
                          {property.type.replace("-", " ").toUpperCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{property.size} SQM</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c="green.6">
                          {formatCurrency(property.price)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getStatusColor(property.status)}
                          variant="light"
                        >
                          {property.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => {
                              setSelectedProperty(property);
                              setViewModalOpen(true);
                            }}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                          {property.status !== "LEASED" && (
                            <>
                              <ActionIcon
                                variant="light"
                                color="yellow"
                                onClick={() => openEditModal(property)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="light"
                                color="red"
                                onClick={() =>
                                  handleDeleteProperty(property._id)
                                }
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {pagination.pages > 1 && (
            <Group justify="apart" mt="md">
              <MantineButton
                disabled={pagination.page === 1}
                onClick={() => fetchProperties(pagination.page - 1)}
                variant="default"
              >
                Previous
              </MantineButton>
              <Text c="dimmed">
                Page {pagination.page} of {pagination.pages}
              </Text>
              <MantineButton
                disabled={pagination.page === pagination.pages}
                onClick={() => fetchProperties(pagination.page + 1)}
                variant="default"
              >
                Next
              </MantineButton>
            </Group>
          )}
        </Card>
        {/* Create Modal (Updated to Mantine Modal) */}
        <Modal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Add New Property"
          size="xl"
          centered
        >
          <Stack gap="md">
            <TextInput
              label="Property Title *"
              placeholder="Enter property title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
            <TextInput
              label="Block and Street *"
              placeholder="Enter block and street"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
              leftSection={<IconMapPin size={16} />}
            />
            <TextInput
              label="Landsize/SQM *"
              placeholder="e.g., 300"
              value={formData.size}
              onChange={(e) => {
                // Only allow numbers
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, size: value });
              }}
              required
            />
            <TextInput
              label="Price *"
              placeholder="e.g., 2,500,000"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: formatPriceInput(e.target.value) })
              }
              required
            />
            <Select
              label="Property Type *"
              placeholder="Select type"
              value={formData.type}
              onChange={(value) =>
                setFormData({ ...formData, type: value || "" })
              }
              data={[
                { value: "single-attached", label: "Single-Attached" },
                { value: "duplex", label: "Duplex" },
                { value: "two-storey-house", label: "Two-Storey House" },
              ]}
              required
            />
            <Select
              label="Status"
              placeholder="Select status"
              value={formData.status}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  status: value as
                    | "CREATED"
                    | "UNDER_INQUIRY"
                    | "APPROVED"
                    | "REJECTED"
                    | "LEASED",
                })
              }
              data={[
                { value: "CREATED", label: "Available" },
                { value: "UNDER_INQUIRY", label: "Under Inquiry" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "LEASED", label: "Leased" },
              ]}
            />
            <ImageUploadPreview
              images={formData.images}
              selectedImages={selectedImages}
              onImageChange={handleImageChange}
              onRemoveImage={handleRemoveImage}
            />
            <Textarea
              label="Description"
              placeholder="Enter property description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
                        <NumberInput
              label="Bedrooms"
              placeholder="e.g., 3"
              value={formData.bedrooms || 0}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  bedrooms: value ? Math.floor(Number(value)) : undefined,
                })
              }
              leftSection={<IconBed size={16} />}
            />
            <NumberInput
              label="Bathrooms"
              placeholder="e.g., 2"
              value={formData.bathrooms || 0}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  bathrooms: value ? Math.floor(Number(value)) : undefined,
                })
              }
              leftSection={<IconDroplet size={16} />}
            />
            <MantineButton
              onClick={handleCreateProperty}
              loading={createLoading}
              leftSection={<IconPlus size={16} />}
              fullWidth
            >
              Create Property
            </MantineButton>
          </Stack>
        </Modal>
        {/* View Modal (Updated to Mantine Modal) */}
        <Modal
          opened={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={selectedProperty?.title || "Property Details"}
          size="xl"
          centered
        >
          {selectedProperty && (
            <Stack gap="lg">
              {selectedProperty.images && selectedProperty.images.length > 0 ? (
                <CustomCarousel
                  images={selectedProperty.images}
                  height={400}
                  alt={selectedProperty.title}
                />
              ) : (
                <Card withBorder radius="md" p="xl" bg="gray">
                  <Center>
                    <Stack align="center" gap="xs">
                      <IconBuilding size={48} color="gray" />
                      <Text c="dimmed">No images available</Text>
                    </Stack>
                  </Center>
                </Card>
              )}
              <Grid gutter="md">
                <Grid.Col span={8}>
                  <Group justify="apart">
                    <Text size="h3" fw={700} c="green.6">
                      {formatCurrency(selectedProperty.price)}
                    </Text>
                    <Badge
                      color={getStatusColor(selectedProperty.status)}
                      size="lg"
                    >
                      {selectedProperty.status}
                    </Badge>
                  </Group>
                  <Stack gap="xs" mt="md">
                    <Group gap="xs">
                      <IconBuilding size={16} />
                      <Text c="dimmed">
                        {selectedProperty.type.replace("-", " ").toUpperCase()}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <IconSquareRounded size={16} />
                      <Text c="dimmed">{selectedProperty.size} SQM</Text>
                    </Group>
                  </Stack>
                  <Group gap="md" mt="md">
                    {selectedProperty.bedrooms &&
                      selectedProperty.bedrooms > 0 && (
                        <Group gap="xs">
                          <IconBed size={16} />
                          <Text c="dimmed">
                            {selectedProperty.bedrooms} Bedroom
                            {selectedProperty.bedrooms > 1 ? "s" : ""}
                          </Text>
                        </Group>
                      )}
                    {selectedProperty.bathrooms &&
                      selectedProperty.bathrooms > 0 && (
                        <Group gap="xs">
                          <IconDroplet size={16} />
                          <Text c="dimmed">
                            {selectedProperty.bathrooms} Bathroom
                            {selectedProperty.bathrooms > 1 ? "s" : ""}
                          </Text>
                        </Group>
                      )}
                  </Group>
                  {selectedProperty.description && (
                    <Card withBorder radius="md" p="md" bg="transparent">
                      <Group gap="xs" mb="xs">
                        <IconFileText size={16} />
                        <Text fw={500}>Description</Text>
                      </Group>
                      <Text c="dimmed">{selectedProperty.description}</Text>
                    </Card>
                  )}
                  {selectedProperty.inquiry && (
                    <Card withBorder radius="md" p="md" bg="blue.0" c="blue.8">
                      <Group gap="xs" mb="md">
                        <IconFileText size={16} />
                        <Text fw={500}>Inquiry Status</Text>
                      </Group>
                      <Stack gap="xs">
                        <Text>
                          <strong>Reason:</strong>{" "}
                          {selectedProperty.inquiry.reason}
                        </Text>
                        <Text>
                          <strong>Duration:</strong>{" "}
                          {selectedProperty.inquiry.duration}
                        </Text>
                        <Text>
                          <strong>Status:</strong>{" "}
                          {selectedProperty.inquiry.status}
                        </Text>
                        {selectedProperty.inquiry.status === "REJECTED" &&
                          selectedProperty.inquiry.rejectionReason && (
                            <Text c="red">
                              <strong>Rejection Reason:</strong>{" "}
                              {selectedProperty.inquiry.rejectionReason}
                            </Text>
                          )}
                      </Stack>
                    </Card>
                  )}
                </Grid.Col>
                <Grid.Col span={4}>
                  <Card withBorder radius="md" p="md" bg="transparent">
                    <Group gap="xs" mb="md">
                      <IconUsers size={16} />
                      <Text fw={500}>Owner Information</Text>
                    </Group>
                    {selectedProperty.owner ? (
                      <Stack gap="xs">
                        <Group gap="xs">
                          <IconUsers size={16} />
                          <Text fw={500}>
                            {selectedProperty.owner.fullName}
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <IconMail size={16} />
                          <Text c="dimmed" style={{ wordBreak: "break-word" }}>
                            {selectedProperty.owner.email}
                          </Text>
                        </Group>
                        {selectedProperty.owner.phone && (
                          <Group gap="xs">
                            <IconPhone size={16} />
                            <Text c="dimmed">
                              {selectedProperty.owner.phone}
                            </Text>
                          </Group>
                        )}
                      </Stack>
                    ) : (
                      <Text c="dimmed">No owner assigned</Text>
                    )}
                  </Card>
                </Grid.Col>
              </Grid>
            </Stack>
          )}
        </Modal>
        {/* Edit Modal (Updated to Mantine Modal) */}
        <Modal
          opened={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Property"
          size="xl"
          centered
        >
          <Stack gap="md">
            <TextInput
              label="Property Title *"
              placeholder="Enter property title"
              value={editFormData.title}
              onChange={(e) =>
                setEditFormData({ ...editFormData, title: e.target.value })
              }
              required
            />
            <TextInput
              label="Block and Street *"
              placeholder="Enter block and street"
              value={editFormData.location}
              onChange={(e) =>
                setEditFormData({ ...editFormData, location: e.target.value })
              }
              required
              leftSection={<IconMapPin size={16} />}
            />
            <TextInput
              label="Landsize/SQM *"
              placeholder="e.g., 300"
              value={editFormData.size}
              onChange={(e) => {
                // Only allow numbers
                const value = e.target.value.replace(/[^0-9]/g, '');
                setEditFormData({ ...editFormData, size: value });
              }}
              required
            />
            <TextInput
              label="Price *"
              placeholder="e.g., 2,500,000"
              value={editFormData.price}
              onChange={(e) =>
                setEditFormData({ ...editFormData, price: formatPriceInput(e.target.value) })
              }
              required
            />
            <Select
              label="Property Type *"
              placeholder="Select type"
              value={editFormData.type}
              onChange={(value) =>
                setEditFormData({ ...editFormData, type: value || "" })
              }
              data={[
                { value: "single-attached", label: "Single-Attached" },
                { value: "duplex", label: "Duplex" },
                { value: "two-storey-house", label: "Two-Storey House" },
              ]}
              required
            />
            <Select
              label="Status"
              placeholder="Select status"
              value={editFormData.status}
              onChange={(value) =>
                setEditFormData({
                  ...editFormData,
                  status: value as
                    | "CREATED"
                    | "UNDER_INQUIRY"
                    | "APPROVED"
                    | "REJECTED"
                    | "LEASED",
                })
              }
              data={[
                { value: "CREATED", label: "Available" },
                { value: "UNDER_INQUIRY", label: "Under Inquiry" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "LEASED", label: "Leased" },
              ]}
            />
            {editFormData.status === "LEASED" && (
              <Stack
                gap="md"
                pt="md"
                style={{
                  borderTop: `1px solid ${theme.colors.gray[colorScheme === "dark" ? 7 : 3]}`,
                }}
              >
                <Title order={4}>Owner Details</Title>
                <TextInput
                  label="Full Name *"
                  placeholder="Enter owner's full name"
                  value={ownerDetails.fullName}
                  onChange={(e) =>
                    setOwnerDetails({
                      ...ownerDetails,
                      fullName: e.target.value,
                    })
                  }
                  required
                />
                <TextInput
                  label="Email *"
                  type="email"
                  placeholder="Enter owner's email"
                  value={ownerDetails.email}
                  onChange={(e) =>
                    setOwnerDetails({
                      ...ownerDetails,
                      email: e.target.value,
                    })
                  }
                  required
                  leftSection={<IconMail size={16} />}
                />
                <TextInput
                  label="Phone"
                  placeholder="Enter owner's phone"
                  value={ownerDetails.phone}
                  onChange={(e) =>
                    setOwnerDetails({
                      ...ownerDetails,
                      phone: e.target.value,
                    })
                  }
                  leftSection={<IconPhone size={16} />}
                />
              </Stack>
            )}
            <ImageUploadPreview
              images={editFormData.images}
              selectedImages={selectedImages}
              onImageChange={handleImageChange}
              onRemoveImage={handleRemoveImage}
              isEdit
            />
            <Textarea
              label="Description"
              placeholder="Enter property description"
              value={editFormData.description}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  description: e.target.value,
                })
              }
            />
            <NumberInput
              label="Bedrooms"
              placeholder="e.g., 3"
              value={editFormData.bedrooms || 0}
              onChange={(value) =>
                setEditFormData({
                  ...editFormData,
                  bedrooms: value ? Math.floor(Number(value)) : undefined,
                })
              }
              leftSection={<IconBed size={16} />}
            />
            <NumberInput
              label="Bathrooms"
              placeholder="e.g., 2"
              value={editFormData.bathrooms || 0}
              onChange={(value) =>
                setEditFormData({
                  ...editFormData,
                  bathrooms: value ? Math.floor(Number(value)) : undefined,
                })
              }
              leftSection={<IconDroplet size={16} />}
            />
            <MantineButton
              onClick={handleEditProperty}
              leftSection={<IconEdit size={16} />}
              fullWidth
            >
              Update Property
            </MantineButton>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
