import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useYami } from '@/src/data/store';
import { DreamDetail, DreamEdit, DreamWizard } from '@/src/features/dreams';

/** /dream opens the guided wizard; /dream?id=… shows that dream, with editing kept separate from viewing. */
export default function DreamScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const dream = useYami(s => s.profile.dreams.find(d => d.id === id));
  const [editing, setEditing] = useState(false);
  if (!dream) return <DreamWizard />;
  return editing ? <DreamEdit dream={dream} onDone={() => setEditing(false)} /> : <DreamDetail dream={dream} onEdit={() => setEditing(true)} />;
}
