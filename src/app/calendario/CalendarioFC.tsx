"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventInput } from "@fullcalendar/core"

interface Props {
  events: EventInput[]
}

export default function CalendarioFC({ events }: Props) {
  return (
    <>
      <style>{`
        .fc-crm .fc {
          --fc-border-color: rgba(255,255,255,0.08);
          --fc-today-bg-color: rgba(227,24,55,0.08);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: rgba(255,255,255,0.04);
          --fc-list-event-hover-bg-color: rgba(255,255,255,0.04);
          --fc-event-bg-color: #3b82f6;
          --fc-event-border-color: #1d4ed8;
          color: var(--crm-text);
        }
        .fc-crm .fc-toolbar-title {
          color: var(--crm-text);
          font-size: 15px !important;
          font-weight: 700;
        }
        .fc-crm .fc-button-primary {
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: rgba(255,255,255,0.65) !important;
          border-radius: 7px !important;
          font-size: 12px !important;
          padding: 4px 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
        .fc-crm .fc-button-primary:hover {
          background: rgba(255,255,255,0.1) !important;
          color: var(--crm-text) !important;
        }
        .fc-crm .fc-button-primary:not(:disabled):active,
        .fc-crm .fc-button-primary:not(:disabled).fc-button-active {
          background: rgba(227,24,55,0.2) !important;
          border-color: rgba(227,24,55,0.4) !important;
          color: var(--crm-accent-light) !important;
        }
        .fc-crm .fc-col-header-cell-cushion {
          color: rgba(255,255,255,0.4);
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-decoration: none;
        }
        .fc-crm .fc-daygrid-day-number {
          color: rgba(255,255,255,0.45);
          font-size: 12px;
          text-decoration: none;
        }
        .fc-crm .fc-day-today .fc-daygrid-day-number {
          color: #E31837;
          font-weight: 800;
        }
        .fc-crm .fc-event {
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 5px;
          cursor: pointer;
          border-width: 0 0 0 3px !important;
        }
        .fc-crm .fc-event-title { font-weight: 600; }
        .fc-crm .fc-more-link {
          color: rgba(255,255,255,0.45);
          font-size: 10.5px;
          font-weight: 600;
        }
        .fc-crm .fc-scrollgrid { border: none !important; }
        .fc-crm td, .fc-crm th { border-color: rgba(255,255,255,0.07) !important; }
        .fc-crm .fc-daygrid-day { min-height: 90px; }
        .fc-crm .fc-toolbar.fc-header-toolbar { margin-bottom: 14px; }
        .fc-crm .fc-daygrid-event-harness + .fc-daygrid-event-harness { margin-top: 2px; }
      `}</style>
      <div
        className="fc-crm"
        style={{
          background: "var(--crm-surface-2)",
          borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "16px",
        }}
      >
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          buttonText={{ today: "Hoy", month: "Mes" }}
          events={events}
          height="auto"
          dayMaxEvents={3}
          firstDay={1}
        />
      </div>
    </>
  )
}
