import type { ScheduleAgenda } from "./schedule-agenda";

function sentenceStart(value: string) {
  return value.replace(/^(\p{L})/u, (letter) => letter.toLocaleUpperCase("es-ES"));
}

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
            <h3>{day.displayLabel ?? day.label.toLocaleUpperCase("es-ES")}</h3>
            <ul className={classes.itemList}>
              {day.items.map((item, index) => (
                <li className={item.timeLabel ? classes.item : classes.note}
                  data-schedule-note={item.timeLabel ? undefined : "true"}
                  key={`${day.label}-${index}-${item.timeLabel}-${item.activity}`}>
                  {item.timeLabel ? <span className={classes.time}>{item.timeLabel}{item.approximate ? <span data-schedule-approximate="true">aprox.</span> : null}</span> : null}
                  <span className={classes.activity}>{sentenceStart(item.activity)}</span>
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
