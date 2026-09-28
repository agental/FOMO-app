import { Calendar, MapPin } from 'lucide-react';
import { CreateActionSheetShell, type CreateActionSheetOption } from './CreateActionSheetShell';

type CreateModalProps = {
  isOpen?: boolean;
  onSelectEvent: () => void;
  onSelectLocation?: () => void;
  onClose: () => void;
  isAdmin?: boolean;
};

export function CreateModal({ isOpen = true, onSelectEvent, onSelectLocation, onClose, isAdmin = false }: CreateModalProps) {
  const options: CreateActionSheetOption[] = [
    {
      key: 'event',
      icon: Calendar,
      title: 'אירוע',
      subtitle: 'ארגנו מסיבה, טיול או מפגש — והזמינו אנשים',
      primary: true,
      onClick: onSelectEvent,
    },
    ...(isAdmin && onSelectLocation
      ? [{
          key: 'location',
          icon: MapPin,
          title: 'הוספת מקום',
          subtitle: 'בית חב״ד או מקום חשוב למפה',
          onClick: onSelectLocation,
        }]
      : []),
  ];

  return (
    <CreateActionSheetShell isOpen={isOpen} title="מה תרצו ליצור?" options={options} onClose={onClose} />
  );
}
