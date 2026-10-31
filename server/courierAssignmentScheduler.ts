import { and, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "./db";
import { courierProfiles, orderCourierAttempts, orderItems, orders } from "./db-tables";
import { sendFonnteMessage } from "./fonnte";

const PASARKU_WEB_URL = process.env.PASARKU_PUBLIC_URL?.trim() || "https://pasarku.onrender.com";
const REMINDER_AFTER_MS = 10 * 60 * 1000;

export type CourierAssignmentSchedulerResult = {
  checked: number;
  remindersSent: number;
  noResponseMarked: number;
  buyerNotificationsSent: number;
  notificationFailures: number;
};

function formatReminderMessage(orderCode: string) {
  return `PASARKU: Pengingat tugas ${orderCode}. Anda memiliki waktu sampai batas 15 menit untuk menerima tugas di portal kurir. Jika tidak direspons, tugas akan dikembalikan ke Admin untuk penugasan ulang.\n\nBuka PWA PASARKU: ${PASARKU_WEB_URL}`;
}

function formatBuyerNoResponseMessage(orderCode: string) {
  return `PASARKU: Status pesanan ${orderCode} diperbarui. Kurir yang ditugaskan belum merespons dalam 15 menit, sehingga Admin akan melakukan penugasan ulang. Pesanan Anda tetap tercatat dan dapat dipantau di PWA PASARKU.\n\nBuka PWA PASARKU: ${PASARKU_WEB_URL}`;
}

/**
 * Dipanggil oleh scheduler aplikasi. Semua perubahan dibatasi pada assignment
 * yang masih aktif, sehingga aman dipanggil berulang setiap beberapa menit.
 */
export async function processCourierAssignmentTimeouts(now = new Date()): Promise<CourierAssignmentSchedulerResult> {
  const db = await getDb();
  const result: CourierAssignmentSchedulerResult = { checked: 0, remindersSent: 0, noResponseMarked: 0, buyerNotificationsSent: 0, notificationFailures: 0 };
  if (!db) return result;

  const pending = await db.select({
    orderId: orders.id,
    orderCode: orders.orderCode,
    buyerWhatsapp: orders.whatsapp,
    courierId: orders.courierId,
    deadline: orders.courierResponseDeadline,
    reminderSentAt: orders.courierReminderSentAt,
    orderStatus: orders.status,
    responseStatus: orders.courierResponseStatus,
  }).from(orders).where(and(
    eq(orders.status, "Menunggu"),
    eq(orders.courierResponseStatus, "assigned"),
    isNotNull(orders.courierId),
    isNotNull(orders.courierResponseDeadline),
  ));
  result.checked = pending.length;

  for (const assignment of pending) {
    if (!assignment.courierId || !assignment.deadline) continue;
    const courierRows = await db.select({ whatsapp: courierProfiles.whatsapp, name: courierProfiles.name })
      .from(courierProfiles).where(eq(courierProfiles.id, assignment.courierId)).limit(1);
    const courier = courierRows[0];
    if (!courier) continue;

    const assignedAttempt = await db.select({ id: orderCourierAttempts.id, assignedAt: orderCourierAttempts.assignedAt, reminderSentAt: orderCourierAttempts.reminderSentAt })
      .from(orderCourierAttempts)
      .where(and(eq(orderCourierAttempts.orderId, assignment.orderId), eq(orderCourierAttempts.courierId, assignment.courierId), eq(orderCourierAttempts.status, "assigned")))
      .orderBy(orderCourierAttempts.assignedAt)
      .limit(1);
    const attempt = assignedAttempt[0];
    const assignedAt = attempt?.assignedAt ?? new Date(assignment.deadline.getTime() - 15 * 60 * 1000);
    const reminderDue = now.getTime() - assignedAt.getTime() >= REMINDER_AFTER_MS;

    if (now < assignment.deadline && reminderDue && !assignment.reminderSentAt && !attempt?.reminderSentAt) {
      try {
        await sendFonnteMessage(courier.whatsapp, formatReminderMessage(assignment.orderCode));
        const sentAt = new Date();
        await db.update(orders).set({ courierReminderSentAt: sentAt, updatedAt: sentAt }).where(and(eq(orders.id, assignment.orderId), eq(orders.courierResponseStatus, "assigned")));
        if (attempt) await db.update(orderCourierAttempts).set({ reminderSentAt: sentAt }).where(eq(orderCourierAttempts.id, attempt.id));
        result.remindersSent += 1;
      } catch (error) {
        result.notificationFailures += 1;
        console.error(`[FONNTE] Pengingat kurir ${assignment.orderCode} gagal:`, error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (now >= assignment.deadline) {
      const updatedAt = new Date();
      const updated = await db.update(orders).set({
        courierId: null,
        courierAcceptedAt: null,
        courierResponseStatus: "no_response",
        courierResponseDeadline: null,
        courierReminderSentAt: null,
        updatedAt,
      }).where(and(eq(orders.id, assignment.orderId), eq(orders.courierResponseStatus, "assigned")));
      const affected = Number((updated as any)?.rowCount ?? (updated as any)?.[0]?.affectedRows ?? 0);
      if (!affected) continue;
      if (attempt) await db.update(orderCourierAttempts).set({ status: "no_response", respondedAt: updatedAt, reason: "tidak_merespons" }).where(eq(orderCourierAttempts.id, attempt.id));
      result.noResponseMarked += 1;
      try {
        await sendFonnteMessage(assignment.buyerWhatsapp, formatBuyerNoResponseMessage(assignment.orderCode));
        result.buyerNotificationsSent += 1;
      } catch (error) {
        result.notificationFailures += 1;
        console.error(`[FONNTE] Notifikasi pembeli ${assignment.orderCode} gagal:`, error instanceof Error ? error.message : error);
      }
    }
  }

  return result;
}
