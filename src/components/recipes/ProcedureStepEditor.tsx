import { useI18n } from "../../app/i18n";
import type { ProcedureStep } from "../../domain/recipes/recipeTypes";
import { createId } from "../../utils/ids";
import { ProcedureStepImageInput } from "./ProcedureStepImageInput";

interface ProcedureStepEditorProps {
  recipeId: string;
  steps: ProcedureStep[];
  onChange: (steps: ProcedureStep[]) => void;
}

export function ProcedureStepEditor({ recipeId, steps, onChange }: ProcedureStepEditorProps) {
  const { t } = useI18n();
  const sortedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);

  function addStep() {
    onChange([
      ...steps,
      {
        id: createId(),
        recipeId,
        sortOrder: steps.length,
        text: "",
      },
    ]);
  }

  function updateStep(id: string, patch: Partial<ProcedureStep>) {
    onChange(steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function deleteStep(id: string) {
    onChange(renumber(steps.filter((step) => step.id !== id)));
  }

  return (
    <section className="editor-section">
      <div className="section-header">
        <h3>{t("Procedure")}</h3>
        <button type="button" onClick={addStep}>
          {t("Add step")}
        </button>
      </div>

      {sortedSteps.length === 0 ? (
        <div className="empty-state">{t("No procedure steps added.")}</div>
      ) : (
        <div className="procedure-step-list">
          {sortedSteps.map((step, index) => (
            <div className="procedure-step-card" key={step.id}>
              <button
                type="button"
                className="icon-button danger step-delete"
                aria-label={t("Delete procedure step")}
                title={t("Delete procedure step")}
                onClick={() => deleteStep(step.id)}
              >
                X
              </button>

              <div className="procedure-step-left">
                <div className="step-number">{index + 1}</div>

                <label className="step-text">
                  {t("Text")}
                  <textarea value={step.text} onChange={(event) => updateStep(step.id, { text: event.target.value })} />
                </label>
              </div>

              <div className="procedure-step-right">
                <label>
                  {t("Time")}
                  <span className="time-pair">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={step.time?.value ?? step.timeMinutes ?? ""}
                      onChange={(event) =>
                        updateStep(step.id, {
                          timeMinutes: undefined,
                          time: event.target.value
                            ? {
                                value: Number(event.target.value),
                                unit: step.time?.unit ?? "min",
                              }
                            : undefined,
                        })
                      }
                    />
                    <select
                      value={step.time?.unit ?? "min"}
                      onChange={(event) =>
                        updateStep(step.id, {
                          timeMinutes: undefined,
                          time: {
                            value: step.time?.value ?? step.timeMinutes ?? 0,
                            unit: event.target.value as "min" | "h",
                          },
                        })
                      }
                    >
                      <option value="min">min</option>
                      <option value="h">h</option>
                    </select>
                  </span>
                </label>

                <label>
                  {t("Temp")}
                  <span className="temperature-pair">
                    <input
                      type="number"
                      step="1"
                      value={step.temperature?.value ?? ""}
                      onChange={(event) =>
                        updateStep(step.id, {
                          temperature: event.target.value
                            ? {
                                value: Number(event.target.value),
                                unit: step.temperature?.unit ?? "C",
                              }
                            : undefined,
                        })
                      }
                    />
                    <select
                      value={step.temperature?.unit ?? "C"}
                      onChange={(event) =>
                        updateStep(step.id, {
                          temperature: {
                            value: step.temperature?.value ?? 0,
                            unit: event.target.value as "C" | "F",
                          },
                        })
                      }
                    >
                      <option value="C">C</option>
                      <option value="F">F</option>
                    </select>
                  </span>
                </label>

                <div className="step-image">
                <span className="field-label">{t("Image")}</span>
                  <ProcedureStepImageInput
                    imageBlobId={step.imageBlobId}
                    onChange={(imageBlobId) => updateStep(step.id, { imageBlobId })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function renumber(steps: ProcedureStep[]) {
  return steps.map((step, index) => ({
    ...step,
    sortOrder: index,
  }));
}
