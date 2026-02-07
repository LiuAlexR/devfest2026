from django.urls import path
from .views import run_energy

urlpatterns = [
    path("energy/run", run_energy, name="energy-run"),
]
