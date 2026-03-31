import AppLayout from "@/components/AppLayout";
import UserMappingManager from "@/components/notifications/UserMappingManager";

const Notifications = () => {
  return (
    <AppLayout title="Notifications">
      <UserMappingManager />
    </AppLayout>
  );
};

export default Notifications;
