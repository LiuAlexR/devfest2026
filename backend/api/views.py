from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse

# backend/api/views.py
import io
import json
import pandas as pd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .services.energy_engine import run_energy_pipeline

@csrf_exempt
def run_energy(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    building_file = request.FILES.get("building_csv")
    energy_file = request.FILES.get("energy_csv")

    if not building_file or not energy_file:
        return JsonResponse(
            {"error": "Missing files. Send building_csv and energy_csv as multipart/form-data."},
            status=400,
        )

    try:
        building_df = pd.read_csv(io.BytesIO(building_file.read()), index_col=0)
        energy_df = pd.read_csv(io.BytesIO(energy_file.read()))
    except Exception as e:
        return JsonResponse({"error": f"CSV parse failed: {str(e)}"}, status=400)

    try:
        result = run_energy_pipeline(building_df, energy_df)
        # JsonResponse needs safe=False for non-dict, but we return dict so safe=True is fine.
        return JsonResponse(result, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
