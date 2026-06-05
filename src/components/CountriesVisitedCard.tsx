import { useState } from 'react';
import { Edit2, X, Plus } from 'lucide-react';
import { WorldMap } from './WorldMap';
import { CountriesPickerModal } from './CountriesPickerModal';
import { ALL_COUNTRIES, TOTAL_COUNTRIES } from '../data/allCountries';
import { supabase } from '../lib/supabase';

interface CountriesVisitedCardProps {
  userId: string;
  visitedCodes: string[];
  isOwnProfile: boolean;
  onUpdate: (codes: string[]) => void;
}

export function CountriesVisitedCard({
  userId, visitedCodes, isOwnProfile, onUpdate,
}: CountriesVisitedCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const countryMap = Object.fromEntries(ALL_COUNTRIES.map(c => [c.iso2, c]));
  const pct = ((visitedCodes.length / TOTAL_COUNTRIES) * 100).toFixed(1);

  const handleDone = async (codes: string[]) => {
    setPickerOpen(false);
    setSaving(true);
    try {
      await supabase.from('users').update({ visited_countries: codes }).eq('id', userId);
      onUpdate(codes);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  const removeCountry = async (code: string) => {
    const next = visitedCodes.filter(c => c !== code);
    await supabase.from('users').update({ visited_countries: next }).eq('id', userId);
    onUpdate(next);
  };

  return (
    <>
      <div style={{
        background: '#fff', borderRadius: 22,
        padding: '18px 18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)',
        marginBottom: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{
            fontSize: 17, fontWeight: 800, color: '#111827',
            fontFamily: 'system-ui, sans-serif',
          }}>
            Countries Visited
          </span>
          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(e => !e)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#F97316', padding: 4,
              }}
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>

        {/* Edit mode: chips + add button */}
        {isEditing && isOwnProfile ? (
          <div>
            {/* Add button */}
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                width: '100%', padding: '12px', borderRadius: 14,
                border: '2px dashed #F97316',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginBottom: visitedCodes.length ? 12 : 0,
                color: '#F97316', fontSize: 14, fontWeight: 700,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <Plus size={15} />
              Add Countries
            </button>

            {/* Chips */}
            {visitedCodes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {visitedCodes.map(code => {
                  const c = countryMap[code];
                  return (
                    <div key={code} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 10px 7px 12px',
                      background: '#FFF7ED', borderRadius: 12,
                      border: '1px solid #FED7AA',
                    }}>
                      <span style={{ fontSize: 18 }}>{c?.flag || '🏳️'}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#C2410C', fontFamily: 'system-ui' }}>
                        {code}
                      </span>
                      <button
                        onClick={() => removeCountry(code)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#FB923C' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Done button */}
            <button
              onClick={() => setIsEditing(false)}
              style={{
                width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                background: '#F3F4F6', color: '#6B7280', fontWeight: 700,
                fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          /* View mode: map + stats */
          <>
            {visitedCodes.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '24px 0',
                color: '#D1D5DB', fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
              }}>
                {isOwnProfile ? 'Tap edit to add countries you\'ve visited' : 'No countries added yet'}
              </div>
            ) : (
              <>
                {/* World map */}
                <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 14, background: '#F9FAFB' }}>
                  <WorldMap visitedCodes={visitedCodes} />
                </div>

                {/* Stats */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
                    {pct}%
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                    of the world explored
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
                    {visitedCodes.length} countries visited
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {saving && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Saving...</div>
        )}
      </div>

      <CountriesPickerModal
        isOpen={pickerOpen}
        selected={visitedCodes}
        onClose={() => setPickerOpen(false)}
        onDone={handleDone}
      />
    </>
  );
}