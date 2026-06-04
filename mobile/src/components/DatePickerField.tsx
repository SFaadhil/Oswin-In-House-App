import React, { useState } from "react";
import { TouchableOpacity, Text, Platform, View, Modal, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fontSize } from "../theme";

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}

function toDate(s: string) {
  return new Date(s + "T12:00:00");
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DatePickerField({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled,
}: Props) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const dateObj = value ? toDate(value) : new Date();

  const displayValue = value
    ? toDate(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  const openPicker = () => {
    if (!disabled) {
      setTempDate(dateObj);
      setShow(true);
    }
  };

  if (Platform.OS === "android") {
    return (
      <View>
        <TouchableOpacity
          style={[styles.field, disabled && styles.fieldDisabled]}
          onPress={openPicker}
          activeOpacity={disabled ? 1 : 0.7}
        >
          <Ionicons name="calendar-outline" size={16} color={value ? colors.text : colors.textMuted} />
          <Text style={[styles.text, !value && styles.placeholder]}>
            {displayValue || placeholder}
          </Text>
        </TouchableOpacity>
        {show && (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShow(false);
              if (selected) onChange(fmt(selected));
            }}
            minimumDate={minDate ? toDate(minDate) : undefined}
            maximumDate={maxDate ? toDate(maxDate) : undefined}
          />
        )}
      </View>
    );
  }

  // iOS: modal with inline calendar + Done/Cancel
  return (
    <View>
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={openPicker}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Ionicons name="calendar-outline" size={16} color={value ? colors.text : colors.textMuted} />
        <Text style={[styles.text, !value && styles.placeholder]}>
          {displayValue || placeholder}
        </Text>
      </TouchableOpacity>
      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.iosOverlay}>
          <View style={styles.iosSheet}>
            <View style={styles.iosToolbar}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.iosCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShow(false);
                  if (tempDate) onChange(fmt(tempDate));
                }}
              >
                <Text style={styles.iosDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate || dateObj}
              mode="date"
              display="inline"
              onChange={(_, selected) => {
                if (selected) setTempDate(selected);
              }}
              minimumDate={minDate ? toDate(minDate) : undefined}
              maximumDate={maxDate ? toDate(maxDate) : undefined}
              accentColor={colors.primary}
              themeVariant="light"
              style={{ backgroundColor: colors.background }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.xs,
  },
  fieldDisabled: { opacity: 0.5 },
  text: { fontSize: fontSize.base, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  iosOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  iosSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  iosToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosCancelText: { fontSize: fontSize.base, color: colors.textMuted },
  iosDoneText: { fontSize: fontSize.base, fontWeight: "700", color: colors.primary },
});
