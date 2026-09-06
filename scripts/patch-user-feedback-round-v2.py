from pathlib import Path
import runpy

p = Path('.github/workflows/hts-calculator-smoke.yml')
s = p.read_text()

needle = "          assert any(s.get('units') for s in suggestions), suggestions\n\n          china_auto = lookup('8703230100','CN', vehicleManufactureYear=2024)"
replacement = "          assert any(s.get('units') for s in suggestions), suggestions\n\n          # China passenger automobile\n          china_auto = lookup('8703230100','CN', vehicleManufactureYear=2024)"
if needle in s:
    s = s.replace(needle, replacement, 1)

needle = "          def quick_amount(m):\n              return m.get('estimatedDuty') if m.get('estimatedDuty') is not None else m.get('worstCaseEstimatedDuty')\n\n          broad = lookup('7321','RU')"
replacement = "          def quick_amount(m):\n              return m.get('estimatedDuty') if m.get('estimatedDuty') is not None else m.get('worstCaseEstimatedDuty')\n\n          # 4/6-digit classifications\n          broad = lookup('7321','RU')"
if needle in s:
    s = s.replace(needle, replacement, 1)

p.write_text(s)
runpy.run_path('scripts/patch-user-feedback-round.py', run_name='__main__')
