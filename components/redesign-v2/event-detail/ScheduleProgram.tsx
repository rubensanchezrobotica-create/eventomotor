import type { ScheduleAgenda } from "./schedule-agenda";

export type ScheduleProgramClassNames = {
  activity: string;
  day: string;
  dayList: string;
  footer: string;
  item: string;
  itemList: string;
  legacy: string;
  note: string;
  time: string;
};

type ScheduleProgramProps = {
  agenda: ScheduleAgenda | null;
  classes: ScheduleProgramClassNames;
  legacyText: string;
};

export default function ScheduleProgram({ agenda, classes, legacyText }: ScheduleProgramProps) {
  if (!agenda) return <p className={classes.legacy}>{legacyText}</p>;

  return (
    <div data-schedule-view="structured">
      {agenda.preamble ? <p className={classes.note}>{agenda.preamble}</p> : null}
      <ol className={classes.dayList}>
        {agenda.days.map((day) => (
          <li className={classes.day} key={day.label}>
            <h3>{day.label}</h3>
            <ul className={classes.itemList}>
              {day.items.map((item, index) => (
                <li className={classes.item} key={`${day.label}-${index}-${item.sourceText}`}>
                  {item.timeLabel ? (
                    <span className={classes.time}>{item.timeLabel}</span>
                  ) : (
                    <span aria-hidden="true" className={classes.time}>—</span>
                  )}
                  <span className={classes.activity}>{item.activity}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {agenda.footerNote ? <p className={classes.footer}>{agenda.footerNote}</p> : null}
    </div>
  );
}
