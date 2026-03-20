"""
Unit tests for image-based liveness checking in expiry_service.
Run from server/: python -m pytest tests/test_expiry.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch, MagicMock
from api.services.expiry_service import check_image_alive, check_images_alive
from api.services.scraper_service import DEFAULT_IMAGE


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


def _make_listing(id, image, source="dubizzle"):
    listing = MagicMock()
    listing.id = id
    listing.image = image
    listing.source = source
    return listing


def test_batch_skips_none_image():
    listings = [_make_listing(1, None)]
    with patch("api.services.expiry_service.check_image_alive") as mock_check:
        dead, checked = check_images_alive(listings)
        mock_check.assert_not_called()
        assert dead == []
        assert checked == 0


def test_batch_skips_empty_string_image():
    listings = [_make_listing(1, "")]
    with patch("api.services.expiry_service.check_image_alive") as mock_check:
        dead, checked = check_images_alive(listings)
        mock_check.assert_not_called()
        assert dead == []
        assert checked == 0


def test_batch_skips_default_image():
    listings = [_make_listing(1, DEFAULT_IMAGE)]
    with patch("api.services.expiry_service.check_image_alive") as mock_check:
        dead, checked = check_images_alive(listings)
        mock_check.assert_not_called()
        assert dead == []
        assert checked == 0


def test_batch_returns_dead_ids():
    listings = [
        _make_listing(1, "https://cdn.dubizzle.com/a.jpg"),
        _make_listing(2, "https://cdn.dubizzle.com/b.jpg"),
        _make_listing(3, "https://cdn.dubizzle.com/c.jpg"),
    ]
    with patch("api.services.expiry_service.check_image_alive", side_effect=[True, False, True]):
        dead, checked = check_images_alive(listings)
        assert dead == [2]
        assert checked == 3


def test_batch_dubicars_uses_no_proxy():
    listings = [_make_listing(1, "https://cdn.dubicars.com/a.jpg", source="dubicars")]
    with patch("api.services.expiry_service.check_image_alive", return_value=True) as mock_check:
        check_images_alive(listings)
        _, kwargs = mock_check.call_args
        assert kwargs["use_proxy"] is False


def test_batch_dubizzle_uses_proxy():
    listings = [_make_listing(1, "https://cdn.dubizzle.com/a.jpg", source="dubizzle")]
    with patch("api.services.expiry_service.check_image_alive", return_value=True) as mock_check:
        check_images_alive(listings)
        _, kwargs = mock_check.call_args
        assert kwargs["use_proxy"] is True
