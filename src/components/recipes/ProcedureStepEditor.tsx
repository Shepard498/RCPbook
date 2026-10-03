import { useEffect, useRef } from "react";
import { useI18n } from "../../app/i18n";
import { X } from "lucide-react";
import { RecipeAddIcons } from "./RecipeAddButton";
import { useAppPreferences } from "../../app/preferences";
import type { ProcedureStep } from "../../domain/recipes/recipeTypes";
import { ProcedureStepImageInput } from "./ProcedureStepImageInput";

interface ProcedureStepEditorProps {
  steps: ProcedureStep[];
  scrollToStepId?: string | null;
  onAddStep: () => void;
  onChange: (steps: ProcedureStep[]) => void;
  onStepScrolled?: (stepId: string) => void;
}

export function ProcedureStepEditor({
  steps,
  scrollToStepId,
  onAddStep,
  onChange,
  onStepScrolled,
}: ProcedureStepEditorProps) {
  const { t } = useI18n();
  const { confirmDeletes } = useAppPreferences();
  const stepRefs = useRef(new Map<string, HTMLDivElement>());
  const sortedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!scrollToStepId) {
      return;
    }

    const stepElement = stepRefs.current.get(scrollToStepId);

    if (!stepElement) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      scrollElementToPanelTop(stepElement);
      onStepScrolled?.(scrollToStepId);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [scrollToStepId, onStepScrolled]);

  function updateStep(id: string, patch: Partial<ProcedureStep>) {
    onChange(steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function deleteStep(id: string) {
    if (confirmDeletes && !window.confirm(t("Delete procedure step? This cannot be undone."))) {
      return;
    }

    onChange(renumber(steps.filter((step) => step.id !== id)));
  }

  function setStepRef(stepId: string, element: HTMLDivElement | null) {
    if (element) {
      stepRefs.current.set(stepId, element);
      return;
    }

    stepRefs.current.delete(stepId);
  }

  return (
    <section className="editor-section">
      <div className="section-header">
        <h3>{t("Procedure")}</h3>
      </div>

      <div className="procedure-step-list">
        {sortedSteps.map((step, index) => (
          <div className="procedure-step-card" key={step.id} ref={(element) => setStepRef(step.id, element)}>
            <button
              type="button"
              className="icon-button danger step-delete"
              aria-label={t("Delete procedure step")}
              title={t("Delete procedure step")}
              onClick={() => deleteStep(step.id)}
            >
              <X size={18} aria-hidden="true" />
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

        <button
          type="button"
          className="add-placeholder-card procedure-step-placeholder"
          onClick={onAddStep}
          aria-label={t("Add step")}
          title={t("Add step")}
        >
          <RecipeAddIcons kind="step" />
          <span>{t("Add step")}</span>
        </button>
      </div>
    </section>
  );
}

function scrollElementToPanelTop(element: HTMLElement) {
  const container = element.closest(".panel-body");

  if (container instanceof HTMLElement) {
    const containerTop = container.getBoundingClientRect().top;
    const elementTop = element.getBoundingClientRect().top;

    container.scrollTo({
      top: container.scrollTop + elementTop - containerTop,
      behavior: "smooth",
    });
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
}

function renumber(steps: ProcedureStep[]) {
  return steps.map((step, index) => ({
    ...step,
    sortOrder: index,
  }));
}
