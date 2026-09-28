import { Calendar, Coffee } from 'lucide-react';
import { CreateActionSheetShell, type CreateActionSheetOption } from './CreateActionSheetShell';

/*
  The map's "+" chooser — styled EXACTLY like the home screen's CreateModal (both use the shared
  CreateActionSheetShell) so both entry points feel identical. Only the secondary option differs:
  the map offers a spontaneous meetup.
*/
interface MapCreateActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: () => void;
  onSelectMeetup: () => void;
}

export function MapCreateActionSheet({
  isOpen,
  onClose,
  onSelectEvent,
  onSelectMeetup,
}: MapCreateActionSheetProps) {
  const options: CreateActionSheetOption[] = [
    {
      key: 'event',
      icon: Calendar,
      title: 'אירוע',
      subtitle: 'ארגנו מסיבה, טיול או מפגש — והזמינו אנשים',
      primary: true,
      onClick: onSelectEvent,
    },
    {
      key: 'meetup',
      icon: Coffee,
      title: 'ציוץ על המפה',
      subtitle: 'פגישה מיידית עם אנשים בסביבה',
      onClick: onSelectMeetup,
    },
  ];

  return (
    <CreateActionSheetShell isOpen={isOpen} title="מה תרצו ליצור?" options={options} onClose={onClose} />
  );
}
