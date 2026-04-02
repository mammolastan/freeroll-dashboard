// app/api/competition-periods/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Update a competition period
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const periodId = parseInt(id);

    if (isNaN(periodId)) {
      return NextResponse.json(
        { error: "Invalid period ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, period_type, start_date, end_date, is_active } = body;

    // Build update data object with only provided fields
    const updateData: {
      name?: string;
      period_type?: string;
      start_date?: Date;
      end_date?: Date;
      is_active?: boolean;
      display_order?: number;
      modified?: Date;
    } = {
      modified: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (period_type !== undefined) {
      updateData.period_type = period_type;
    }

    if (start_date !== undefined) {
      updateData.start_date = new Date(start_date);
      // Recalculate display_order based on new start_date
      const startDateObj = new Date(start_date);
      updateData.display_order = startDateObj.getFullYear() * 100 + (startDateObj.getMonth() + 1);
    }

    if (end_date !== undefined) {
      updateData.end_date = new Date(end_date);
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active === true || is_active === "true";
    }

    const updatedPeriod = await prisma.competition_periods.update({
      where: { id: periodId },
      data: updateData,
      select: {
        id: true,
        name: true,
        period_type: true,
        start_date: true,
        end_date: true,
        is_active: true,
        display_order: true,
      },
    });

    return NextResponse.json(updatedPeriod);
  } catch (error) {
    console.error("Error updating competition period:", error);
    return NextResponse.json(
      { error: "Failed to update competition period" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a competition period
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const periodId = parseInt(id);

    if (isNaN(periodId)) {
      return NextResponse.json(
        { error: "Invalid period ID" },
        { status: 400 }
      );
    }

    await prisma.competition_periods.delete({
      where: { id: periodId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting competition period:", error);
    return NextResponse.json(
      { error: "Failed to delete competition period" },
      { status: 500 }
    );
  }
}
