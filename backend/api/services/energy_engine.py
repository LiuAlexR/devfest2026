import numpy as np
import pandas as pd
from sklearn.linear_model import HuberRegressor
from sklearn.metrics import r2_score, mean_absolute_error

BUILDING_TYPES = [
    "Residential_1-4", "Residential_Multi", "Office", "Store",
    "Education", "Health", "Warehouse", "Other_Commercial"
]

def _zfill_zip(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.zfill(5)

def prepare_regression_data(building_summary: pd.DataFrame, energy: pd.DataFrame) -> pd.DataFrame:
    b = building_summary.copy()
    b.index = b.index.astype(str).str.strip().str.zfill(5)

    e = energy.copy()
    if "zipcode" in e.columns and "ZipCode" not in e.columns:
        e = e.rename(columns={"zipcode": "ZipCode"})
    if "ZipCode" not in e.columns:
        raise ValueError("energy CSV must contain a ZipCode column")

    e["ZipCode"] = _zfill_zip(e["ZipCode"])

    df = b.merge(e, left_index=True, right_on="ZipCode", how="inner").copy()

    # Ensure all predictor columns exist
    for bt in BUILDING_TYPES:
        if bt not in df.columns:
            df[bt] = 0.0

    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    return df

def run_huber(df: pd.DataFrame, target: str):
    X = df[BUILDING_TYPES].astype(float)
    y = df[target].astype(float)

    # Remove zero/neg targets for sane metrics
    mask = y > 0
    X = X.loc[mask]
    y = y.loc[mask]

    model = HuberRegressor(
        epsilon=1.35,
        max_iter=200,
        fit_intercept=False,  # keeps coefficients interpretable as kWh/m²
        alpha=0.0
    )
    model.fit(X, y)
    pred = model.predict(X)

    metrics = {
        "r2": float(r2_score(y, pred)),
        "mae": float(mean_absolute_error(y, pred)),
        "within_20pct": float((np.abs((pred - y) / y) * 100 <= 20).mean() * 100),
        "n": int(len(y)),
    }
    coeffs = {bt: float(c) for bt, c in zip(BUILDING_TYPES, model.coef_)}
    return coeffs, pred, X.index, metrics

def build_output(df: pd.DataFrame, elec_pred, fuel_pred, elec_coeffs, fuel_coeffs, metrics) -> dict:
    out = {
        "metadata": {
            "units": {
                "energy": "kWh/year",
                "floor_area": "m2",
                "energy_intensity": "kWh/m2/year",
            },
            "building_types": BUILDING_TYPES,
        },
        "energy_intensities": {"electricity": elec_coeffs, "fuel": fuel_coeffs},
        "metrics": metrics,
        "zip_codes": {},
    }

    df = df.reset_index(drop=True)

    def pct_err(pred, actual):
        return None if actual <= 0 else float((pred - actual) / actual * 100)

    for i, row in df.iterrows():
        zip_id = str(row["ZipCode"]).zfill(5)

        elec_contrib = {}
        fuel_contrib = {}

        for bt in BUILDING_TYPES:
            area = float(row.get(bt, 0.0))
            ei = float(elec_coeffs.get(bt, 0.0))
            fi = float(fuel_coeffs.get(bt, 0.0))
            elec_contrib[bt] = {
                "floor_area_m2": area,
                "energy_intensity_kWh_m2": ei,
                "energy_consumption_kWh": area * ei,
            }
            fuel_contrib[bt] = {
                "floor_area_m2": area,
                "energy_intensity_kWh_m2": fi,
                "energy_consumption_kWh": area * fi,
            }

        actual_e = float(row.get("Annual_kWh_Electricity", 0.0))
        actual_f = float(row.get("Annual_kWh_Fuel", 0.0))
        pred_e = float(elec_pred[i])
        pred_f = float(fuel_pred[i])

        out["zip_codes"][zip_id] = {
            "electricity": {
                "actual_kWh": actual_e,
                "predicted_kWh": pred_e,
                "percent_error": pct_err(pred_e, actual_e),
                "contributions_by_building_type": elec_contrib,
            },
            "fuel": {
                "actual_kWh": actual_f,
                "predicted_kWh": pred_f,
                "percent_error": pct_err(pred_f, actual_f),
                "contributions_by_building_type": fuel_contrib,
            },
            "total": {
                "actual_kWh": actual_e + actual_f,
                "predicted_kWh": pred_e + pred_f,
            },
        }

    return out

def run_energy_pipeline(building_summary: pd.DataFrame, energy: pd.DataFrame) -> dict:
    df = prepare_regression_data(building_summary, energy)

    elec_coeffs, elec_pred, elec_idx, elec_metrics = run_huber(df, "Annual_kWh_Electricity")
    fuel_coeffs, fuel_pred, fuel_idx, fuel_metrics = run_huber(df, "Annual_kWh_Fuel")

    # Align on common rows
    idx = elec_idx.intersection(fuel_idx)
    df2 = df.loc[idx].copy()

    elec_map = {ix: elec_pred[i] for i, ix in enumerate(elec_idx)}
    fuel_map = {ix: fuel_pred[i] for i, ix in enumerate(fuel_idx)}
    elec_aligned = np.array([elec_map[ix] for ix in idx])
    fuel_aligned = np.array([fuel_map[ix] for ix in idx])

    metrics = {"electricity": elec_metrics, "fuel": fuel_metrics}
    return build_output(df2, elec_aligned, fuel_aligned, elec_coeffs, fuel_coeffs, metrics)
