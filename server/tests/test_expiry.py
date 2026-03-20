"""
Unit tests for image-based liveness checking in expiry_service.
Run from server/: python -m pytest tests/test_expiry.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch, MagicMock
from api.services.expiry_service import check_image_alive


class FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


def test_image_404_returns_false():
    with patch("api.services.expiry_service.requests.head", return_value=FakeResponse(404)):
        assert check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True) is False


def test_image_200_returns_true():
    with patch("api.services.expiry_service.requests.head", return_value=FakeResponse(200)):
        assert check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True) is True


def test_image_403_assumes_alive():
    with patch("api.services.expiry_service.requests.head", return_value=FakeResponse(403)):
        assert check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True) is True


def test_image_401_assumes_alive():
    with patch("api.services.expiry_service.requests.head", return_value=FakeResponse(401)):
        assert check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True) is True


def test_image_network_error_assumes_alive():
    with patch("api.services.expiry_service.requests.head", side_effect=Exception("timeout")):
        assert check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True) is True


def test_image_500_assumes_alive():
    with patch("api.services.expiry_service.requests.head", return_value=FakeResponse(500)):
        assert check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True) is True


def test_proxy_used_when_use_proxy_true():
    with patch("api.services.expiry_service._get_proxies", return_value={"https": "http://proxy:8080"}) as mock_proxies, \
         patch("api.services.expiry_service.requests.head", return_value=FakeResponse(200)) as mock_head:
        check_image_alive("https://cdn.dubizzle.com/img/123.jpg", use_proxy=True)
        mock_proxies.assert_called_once()
        _, kwargs = mock_head.call_args
        assert kwargs["proxies"] == {"https": "http://proxy:8080"}


def test_no_proxy_when_use_proxy_false():
    with patch("api.services.expiry_service.requests.head", return_value=FakeResponse(200)) as mock_head:
        check_image_alive("https://cdn.dubicars.com/img/123.jpg", use_proxy=False)
        _, kwargs = mock_head.call_args
        assert kwargs.get("proxies") is None
